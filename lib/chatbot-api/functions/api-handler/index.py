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
    AppSyncResolver,
    content_types,
)
from routes.health import router as health_router
from routes.embeddings import router as embeddings_router
from routes.cross_encoders import router as cross_encoders_router
from routes.rag import router as rag_router
from routes.models import router as models_router
from routes.workspaces import router as workspaces_router
from routes.sessions import router as sessions_router
from routes.semantic_search import router as semantic_search_router
from routes.documents import router as documents_router
from routes.kendra import router as kendra_router

tracer = Tracer()
logger = Logger()


# cors_config = CORSConfig(allow_origin="*", max_age=0)
# app = APIGatewayRestResolver(
#     cors=cors_config,
#     strip_prefixes=["/v1"],
#     serializer=lambda obj: json.dumps(obj, cls=genai_core.utils.json.CustomEncoder),
# )

app = AppSyncResolver()

app.include_router(health_router)
app.include_router(rag_router)
app.include_router(embeddings_router)
app.include_router(cross_encoders_router)
app.include_router(models_router)
app.include_router(workspaces_router)
app.include_router(sessions_router)
app.include_router(semantic_search_router)
app.include_router(documents_router)
app.include_router(kendra_router)


@logger.inject_lambda_context(
    log_event=True, correlation_id_path=correlation_paths.API_GATEWAY_REST
)
@tracer.capture_lambda_handler
def handler(event: dict, context: LambdaContext) -> dict:
    return app.resolve(event, context)
