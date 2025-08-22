from typing import Any

import genai_core.agents
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler.appsync import Router
from genai_core.auth import UserPermissions

tracer = Tracer()
router = Router()
logger = Logger()
permissions = UserPermissions(router)


@router.resolver(field_name="listAgents")
@tracer.capture_method
@permissions.approved_roles(
    [permissions.ADMIN_ROLE, permissions.WORKSPACES_MANAGER_ROLE]
)
def agents() -> list[dict[str, Any]]:
    return genai_core.agents.list_agents()
