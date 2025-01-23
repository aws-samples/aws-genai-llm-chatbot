from pydantic import BaseModel, Field
from common.constant import (
    ID_FIELD_VALIDATION,
    SAFE_PROMPT_STR_REGEX,
    SAFE_SHORT_STR_VALIDATION,
    SAFE_STR_REGEX,
    UserRole,
)
from common.validation import IdValidation
import genai_core.applications
import genai_core.presign
import genai_core.sessions
import genai_core.types
import genai_core.auth
import genai_core.utils.json
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler.appsync import Router
from genai_core.auth import UserPermissions
from decimal import Decimal

tracer = Tracer()
router = Router()
logger = Logger()
permissions = UserPermissions(router)

name_regex = r"^[\w\s+_-]+$"


class CreateApplicationRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100, pattern=name_regex)
    model: str = SAFE_SHORT_STR_VALIDATION
    workspace: str = Field(None, max_length=512, pattern=SAFE_STR_REGEX)
    systemPrompt: str = Field(None, max_length=256, pattern=SAFE_PROMPT_STR_REGEX)
    systemPromptRag: str = Field(None, max_length=256, pattern=SAFE_PROMPT_STR_REGEX)
    condenseSystemPrompt: str = Field(
        None, max_length=256, pattern=SAFE_PROMPT_STR_REGEX
    )
    roles: list[str] = [SAFE_SHORT_STR_VALIDATION]
    allowImageInput: bool
    allowVideoInput: bool
    allowDocumentInput: bool
    enableGuardrails: bool
    streaming: bool
    maxTokens: int = Field(ge=1, le=8192)
    temperature: Decimal = Field(ge=0, le=1)
    topP: Decimal = Field(ge=0, le=1)


class UpdateApplicationRequest(BaseModel):
    id: str = ID_FIELD_VALIDATION
    name: str = Field(min_length=1, max_length=100, pattern=name_regex)
    model: str = SAFE_SHORT_STR_VALIDATION
    workspace: str = Field(None, max_length=512, pattern=SAFE_STR_REGEX)
    systemPrompt: str = Field(None, max_length=256, pattern=SAFE_PROMPT_STR_REGEX)
    systemPromptRag: str = Field(None, max_length=256, pattern=SAFE_PROMPT_STR_REGEX)
    condenseSystemPrompt: str = Field(
        None, max_length=256, pattern=SAFE_PROMPT_STR_REGEX
    )
    roles: list[str] = [SAFE_SHORT_STR_VALIDATION]
    allowImageInput: bool
    allowVideoInput: bool
    allowDocumentInput: bool
    enableGuardrails: bool
    streaming: bool
    maxTokens: int = Field(ge=1, le=8192)
    temperature: Decimal = Field(ge=0, le=1)
    topP: Decimal = Field(ge=0, le=1)


@router.resolver(field_name="listApplications")
@tracer.capture_method
def list_applications():
    user_roles = genai_core.auth.get_user_roles(router)
    if user_roles is None:
        raise genai_core.types.CommonError("User does not have any roles")

    if (
        UserRole.ADMIN.value in user_roles
        or UserRole.WORKSPACE_MANAGER.value in user_roles
    ):
        applications_result = genai_core.applications.list_applications()
    else:
        applications_result = []
        for role in user_roles:
            role_applications = genai_core.applications.list_applications_by_role(role)
            applications_result.extend(role_applications)

        # Remove duplicates if an application is returned for multiple roles
        applications_result = list(
            {app["Id"]: app for app in applications_result}.values()
        )

    if UserRole.ADMIN.value in user_roles:
        applications = [
            {
                "id": app.get("Id"),
                "name": app.get("Name"),
                "model": app.get("Model"),
                "workspace": app.get("Workspace"),
                "outputModalities": app.get("OutputModalities"),
                "systemPrompt": app.get("SystemPrompt"),
                "systemPromptRag": app.get("SystemPromptRag"),
                "condenseSstemPrompt": app.get("CondenseSystemPrompt"),
                "roles": app.get("Roles"),
                "allowImageInput": app.get("AllowImageInput", False),
                "allowVideoInput": app.get("AllowVideoInput", False),
                "allowDocumentInput": app.get("AllowDocumentInput", False),
                "enableGuardrails": app.get("EnableGuardrails", False),
                "streaming": app.get("Streaming", False),
                "maxTokens": app.get("MaxTokens", 512),
                "temperature": app.get("Temperature", 0.6),
                "topP": app.get("TopP", 0.9),
                "createTime": app.get("CreateTime"),
                "updateTime": app.get("UpdateTime"),
            }
            for app in applications_result
        ]
    else:
        applications = [
            {
                "id": app.get("Id"),
                "name": app.get("Name"),
                "outputModalities": app.get("OutputModalities"),
                "allowImageInput": app.get("AllowImageInput", False),
                "allowVideoInput": app.get("AllowVideoInput", False),
                "allowDocumentInput": app.get("AllowDocumentInput", False),
                "streaming": app.get("Streaming", False),
            }
            for app in applications_result
        ]

    return applications


@router.resolver(field_name="getApplication")
@tracer.capture_method
def get_application(id: str):
    IdValidation(**{"id": id})
    user_roles = genai_core.auth.get_user_roles(router)
    if user_roles is None:
        raise genai_core.types.CommonError("User does not have any roles")

    app = genai_core.applications.get_application(id)
    if not app:
        return None

    app_roles = app.get("Roles", [])
    if UserRole.ADMIN.value in user_roles:
        return {
            "id": app.get("Id"),
            "name": app.get("Name"),
            "model": app.get("Model"),
            "workspace": app.get("Workspace"),
            "outputModalities": app.get("OutputModalities"),
            "systemPrompt": app.get("SystemPrompt"),
            "systemPromptRag": app.get("SystemPromptRag"),
            "condenseSystemPrompt": app.get("CondenseSystemPrompt"),
            "roles": app.get("Roles"),
            "allowImageInput": app.get("AllowImageInput", False),
            "allowVideoInput": app.get("AllowVideoInput", False),
            "allowDocumentInput": app.get("AllowDocumentInput", False),
            "enableGuardrails": app.get("EnableGuardrails", False),
            "streaming": app.get("Streaming", False),
            "maxTokens": app.get("MaxTokens", 512),
            "temperature": app.get("Temperature", 0.6),
            "topP": app.get("TopP", 0.9),
            "createTime": app.get("CreateTime"),
            "updateTime": app.get("UpdateTime"),
        }
    elif set(user_roles).intersection(set(app_roles)):
        return {
            "id": app.get("Id"),
            "name": app.get("Name"),
            "outputModalities": app.get("OutputModalities"),
            "allowImageInput": app.get("AllowImageInput", False),
            "allowVideoInput": app.get("AllowVideoInput", False),
            "allowDocumentInput": app.get("AllowDocumentInput", False),
            "streaming": app.get("Streaming", False),
        }
    else:
        raise genai_core.types.CommonError("Unauthorized")


@router.resolver(field_name="deleteApplication")
@tracer.capture_method
@permissions.approved_roles([permissions.ADMIN_ROLE])
def delete_application(id):
    IdValidation(**{"id": id})
    result = genai_core.applications.delete_application(id)

    return result


@router.resolver(field_name="createApplication")
@tracer.capture_method
@permissions.approved_roles([permissions.ADMIN_ROLE])
def create_application(input: dict):
    request = CreateApplicationRequest(**input)
    ret_value = _create_application(request)

    return ret_value


@router.resolver(field_name="updateApplication")
@tracer.capture_method
@permissions.approved_roles([permissions.ADMIN_ROLE])
def update_application(input: dict):
    request = UpdateApplicationRequest(**input)

    application = genai_core.applications.update_application(
        request.id,
        request.name,
        request.model,
        request.workspace,
        request.systemPrompt,
        request.systemPromptRag,
        request.condenseSystemPrompt,
        request.roles,
        request.allowImageInput,
        request.allowVideoInput,
        request.allowDocumentInput,
        request.enableGuardrails,
        request.streaming,
        request.maxTokens,
        request.temperature,
        request.topP,
    )

    return {
        "id": application.get("Id"),
        "name": application.get("Name"),
        "model": application.get("Model"),
        "workspace": application.get("Workspace"),
        "systemPrompt": application.get("SystemPrompt"),
        "systemPromptRag": application.get("SystemPromptRag"),
        "condenseSystemPrompt": application.get("CondenseSystemPrompt"),
        "roles": application.get("Roles"),
        "allowImageInput": application.get("AllowImageInput", False),
        "allowVideoInput": application.get("AllowVideoInput", False),
        "allowDocumentInput": application.get("AllowDocumentInput", False),
        "enableGuardrails": application.get("EnableGuardrails", False),
        "streaming": application.get("Streaming", False),
        "maxTokens": application.get("MaxTokens", 512),
        "temperature": application.get("Temperature", 0.6),
        "topP": application.get("TopP", 0.9),
        "createTime": application.get("CreateTime"),
        "updateTime": application.get("UpdateTime"),
    }


def _create_application(request: CreateApplicationRequest):
    application = genai_core.applications.create_application(
        request.name,
        request.model,
        request.workspace,
        request.systemPrompt,
        request.systemPromptRag,
        request.condenseSystemPrompt,
        request.roles,
        request.allowImageInput,
        request.allowVideoInput,
        request.allowDocumentInput,
        request.enableGuardrails,
        request.streaming,
        request.maxTokens,
        request.temperature,
        request.topP,
    )

    return {
        "id": application.get("Id"),
        "name": application.get("Name"),
        "model": application.get("Model"),
        "workspace": application.get("Workspace"),
        "systemPrompt": application.get("SystemPrompt"),
        "systemPromptRag": application.get("SystemPromptRag"),
        "condenseSystemPrompt": application.get("CondenseSystemPrompt"),
        "roles": application.get("Roles"),
        "allowImageInput": application.get("AllowImageInput", False),
        "allowVideoInput": application.get("AllowVideoInput", False),
        "allowDocumentInput": application.get("AllowDocumentInput", False),
        "enableGuardrails": application.get("EnableGuardrails", False),
        "streaming": application.get("Streaming", False),
        "maxTokens": application.get("MaxTokens", 512),
        "temperature": application.get("Temperature", 0.6),
        "topP": application.get("TopP", 0.9),
        "createTime": application.get("CreateTime"),
        "updateTime": application.get("UpdateTime"),
    }
