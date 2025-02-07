from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.logging import correlation_paths
from aws_lambda_powertools.utilities.typing import LambdaContext
from aws_lambda_powertools.event_handler import (
    AppSyncResolver,
)
from pydantic import ValidationError

from genai_core.types import CommonError
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
from routes.user_feedback import router as user_feedback_router
from routes.bedrock_kb import router as bedrock_kb_router
from routes.roles import router as roles_router
from routes.applications import router as applicatiion_router


tracer = Tracer()
logger = Logger(serialize_stacktrace=True)

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
app.include_router(user_feedback_router)
app.include_router(bedrock_kb_router)
app.include_router(roles_router)
app.include_router(applicatiion_router)


@logger.inject_lambda_context(
    log_event=False, correlation_id_path=correlation_paths.APPSYNC_RESOLVER
)
@tracer.capture_lambda_handler
def handler(event: dict, context: LambdaContext) -> dict:
    try:
        logger.info(
            "Incoming request for " + event["info"]["fieldName"],
            arguments=event["arguments"],
            identify=event["identity"],
        )
        return app.resolve(event, context)
    except ValidationError as e:
        errors = e.errors(include_url=False, include_context=False, include_input=False)
        logger.warning("Validation error", errors=errors)
        raise ValueError(f"Invalid request. Details: {errors}")
    except CommonError as e:
        logger.warning(str(e))
        raise e
    except Exception as e:
        # Do not return an unknown exception to the end user.
        # Instead return a generic message
        # This is to prevent leaking internal information.
        logger.exception(e)
        raise RuntimeError("Something went wrong")
