import genai_core.parameters
import genai_core.kendra
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler.appsync import Router
from genai_core.auth import UserPermissions

tracer = Tracer()
router = Router()
logger = Logger()
permissions = UserPermissions(router)


@router.resolver(field_name="listRagEngines")
@tracer.capture_method
@permissions.approved_roles(
    [permissions.ADMIN_ROLE, permissions.WORKSPACES_MANAGER_ROLE]
)
def engines():
    config = genai_core.parameters.get_config()

    engines = config["rag"]["engines"]
    ret_value = [
        {
            "id": "aurora",
            "name": "Amazon Aurora",
            "enabled": engines.get("aurora", {}).get("enabled", False) == True,
        },
        {
            "id": "opensearch",
            "name": "Amazon OpenSearch",
            "enabled": engines.get("opensearch", {}).get("enabled", False) == True,
        },
        {
            "id": "kendra",
            "name": "Amazon Kendra",
            "enabled": engines.get("kendra", {}).get("enabled", False) == True,
        },
        {
            "id": "bedrock_kb",
            "name": "Bedrock Knowledge Bases",
            "enabled": engines.get("knowledgeBase", {}).get("enabled", False) == True,
        },
    ]

    return ret_value
