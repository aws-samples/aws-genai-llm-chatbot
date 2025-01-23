import genai_core.models
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler.appsync import Router
from genai_core.auth import UserPermissions

import genai_core.roles

tracer = Tracer()
router = Router()
logger = Logger()
permissions = UserPermissions(router)


@router.resolver(field_name="listRoles")
@tracer.capture_method
@permissions.approved_roles([permissions.ADMIN_ROLE])
def list_roles():
    roles = genai_core.roles.list_roles()

    return roles
