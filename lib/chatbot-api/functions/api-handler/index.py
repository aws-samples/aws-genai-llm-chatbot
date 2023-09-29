import json
import genai_core.types
import genai_core.parameters
import genai_core.utils.json
from pydantic import ValidationError
from botocore.exceptions import ClientError
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.logging import correlation_paths
from aws_lambda_powertools.utilities.typing import LambdaContext
from aws_lambda_powertools.event_handler.api_gateway import Response
from aws_lambda_powertools.event_handler import (
    APIGatewayRestResolver,
    CORSConfig,
    content_types,
)
from routes.health import router as health_router
from routes.embeddings import router as embeddings_router
from routes.cross_encoders import router as cross_encoders_router
from routes.rag import router as rag_router
from routes.llms import router as llms_router
from routes.workspaces import router as workspaces_router
from routes.sessions import router as sessions_router
from routes.semantic_search import router as semantic_search_router
from routes.documents import router as documents_router

tracer = Tracer()
logger = Logger()


cors_config = CORSConfig(allow_origin="*", max_age=0)
app = APIGatewayRestResolver(
    cors=cors_config,
    strip_prefixes=["/v1"],
    serializer=lambda obj: json.dumps(
        obj, cls=genai_core.utils.json.CustomEncoder),
)

app.include_router(health_router)
app.include_router(rag_router)
app.include_router(embeddings_router)
app.include_router(cross_encoders_router)
app.include_router(llms_router)
app.include_router(workspaces_router)
app.include_router(sessions_router)
app.include_router(semantic_search_router)
app.include_router(documents_router)


@app.exception_handler(genai_core.types.CommonError)
def handle_value_error(e: genai_core.types.CommonError):
    logger.exception(e)

    return Response(
        status_code=200,
        content_type=content_types.APPLICATION_JSON,
        body=json.dumps(
            {"error": True, "message": str(e)}, cls=genai_core.utils.json.CustomEncoder
        ),
    )


@app.exception_handler(ClientError)
def handle_value_error(e: ClientError):
    logger.exception(e)

    return Response(
        status_code=200,
        content_type=content_types.APPLICATION_JSON,
        body=json.dumps(
            {"error": True, "message": str(e)},
            cls=genai_core.utils.json.CustomEncoder,
        ),
    )


@app.exception_handler(ValidationError)
def handle_value_error(e: ValidationError):
    logger.exception(e)

    return Response(
        status_code=200,
        content_type=content_types.APPLICATION_JSON,
        body=json.dumps(
            {"error": True, "message": [str(error) for error in e.errors()]},
            cls=genai_core.utils.json.CustomEncoder,
        ),
    )


@logger.inject_lambda_context(
    log_event=True, correlation_id_path=correlation_paths.API_GATEWAY_REST
)
@tracer.capture_lambda_handler
def handler(event: dict, context: LambdaContext) -> dict:
    origin_verify_header_value = genai_core.parameters.get_origin_verify_header_value()
    if event["headers"]["X-Origin-Verify"] == origin_verify_header_value:
        return app.resolve(event, context)

    return {"statusCode": 403, "body": "Forbidden"}
