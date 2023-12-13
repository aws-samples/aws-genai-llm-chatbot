from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler.appsync import Router

tracer = Tracer()
router = Router()
logger = Logger()


@router.resolver(field_name="checkHealth")
@tracer.capture_method
def health():
    return True
