import genai_core.models
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler.api_gateway import Router

tracer = Tracer()
router = Router()
logger = Logger()


@router.get("/models")
@tracer.capture_method
def models():
    models = genai_core.models.list_models()

    return {"ok": True, "data": models}
