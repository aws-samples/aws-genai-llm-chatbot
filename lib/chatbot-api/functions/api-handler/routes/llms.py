import genai_core.llms
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler.api_gateway import Router

tracer = Tracer()
router = Router()
logger = Logger()


@router.get("/llms")
@tracer.capture_method
def llms():
    models = genai_core.llms.list_models()

    return {"ok": True, "data": models}
