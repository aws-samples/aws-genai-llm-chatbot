import genai_core.parameters
import genai_core.bedrock_kb
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler.appsync import Router

tracer = Tracer()
router = Router()
logger = Logger()


@router.resolver(field_name="listBedrockKnowledgeBases")
@tracer.capture_method
def list_bedrock_kbs():
    indexes = genai_core.bedrock_kb.list_bedrock_kbs()

    return indexes
