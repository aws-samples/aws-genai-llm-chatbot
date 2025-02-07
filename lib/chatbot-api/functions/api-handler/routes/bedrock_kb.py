import genai_core.parameters
import genai_core.bedrock_kb
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler.appsync import Router
from genai_core.auth import UserPermissions

tracer = Tracer()
router = Router()
logger = Logger()
permissions = UserPermissions(router)


@router.resolver(field_name="listBedrockKnowledgeBases")
@tracer.capture_method
@permissions.approved_roles(
    [permissions.ADMIN_ROLE, permissions.WORKSPACES_MANAGER_ROLE]
)
def list_bedrock_kbs():
    indexes = genai_core.bedrock_kb.list_bedrock_kbs()

    return indexes
