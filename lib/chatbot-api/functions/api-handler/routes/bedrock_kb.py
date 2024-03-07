import genai_core.parameters
import genai_core.kendra
from pydantic import BaseModel
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler.appsync import Router

tracer = Tracer()
router = Router()
logger = Logger()


class KendraDataSynchRequest(BaseModel):
    workspaceId: str


@router.resolver(field_name="listBedrockKnowledgeBases")
@tracer.capture_method
def list_bedrock_kbs():
    indexes = genai_core.kendra.list_bedrock_kbs()

    return indexes
