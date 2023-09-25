from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler.api_gateway import Router

tracer = Tracer()
router = Router()
logger = Logger()


@router.get("/health")
@tracer.capture_method
def health():
    return {"ok": True}
