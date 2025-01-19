from typing import List, Optional
import boto3
import os
import json
from datetime import datetime
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.typing import LambdaContext
from aws_lambda_powertools.logging import correlation_paths
from pydantic import BaseModel, Field, ValidationError


from applications import get_application


tracer = Tracer()
logger = Logger(log_uncaught_exceptions=True)

sns = boto3.client("sns")
TOPIC_ARN = os.environ.get("SNS_TOPIC_ARN", "")

MAX_STR_INPUT_LENGTH = 1000000
SAFE_STR_REGEX = r"^[A-Za-z0-9-_. ]*$"
SAFE_SHORT_STR_VALIDATION = Field(min_length=0, max_length=500, pattern=SAFE_STR_REGEX)
SAFE_SHORT_STR_VALIDATION_OPTIONAL = Field(
    min_length=0, max_length=500, pattern=SAFE_STR_REGEX, default=None
)


class ModelKwargsFieldValidation(BaseModel):
    streaming: Optional[bool] = None
    maxTokens: Optional[int] = Field(gt=0, lt=1000000, default=None)
    temperature: Optional[float] = Field(ge=0, le=1, default=None)
    topP: Optional[float] = Field(ge=0, le=1, default=None)


class FileFieldValidation(BaseModel):
    provider: Optional[str] = SAFE_SHORT_STR_VALIDATION_OPTIONAL
    key: Optional[str] = SAFE_SHORT_STR_VALIDATION_OPTIONAL
    modality: Optional[str] = SAFE_SHORT_STR_VALIDATION_OPTIONAL


class DataFieldValidation(BaseModel):
    modelName: Optional[str] = Field(
        min_length=0, max_length=500, pattern=r"^[A-Za-z0-9-_. /:]*$", default=None
    )
    provider: Optional[str] = SAFE_SHORT_STR_VALIDATION_OPTIONAL
    sessionId: Optional[str] = SAFE_SHORT_STR_VALIDATION_OPTIONAL
    workspaceId: Optional[str] = SAFE_SHORT_STR_VALIDATION_OPTIONAL
    mode: Optional[str] = SAFE_SHORT_STR_VALIDATION_OPTIONAL
    text: Optional[str] = Field(
        min_length=1, max_length=MAX_STR_INPUT_LENGTH, default=None
    )
    images: Optional[List[FileFieldValidation]] = None
    documents: Optional[List[FileFieldValidation]] = None
    modelKwargs: Optional[ModelKwargsFieldValidation] = None


class InputValidation(BaseModel):
    action: str = SAFE_SHORT_STR_VALIDATION
    modelInterface: str = SAFE_SHORT_STR_VALIDATION
    data: DataFieldValidation


@tracer.capture_lambda_handler
@logger.inject_lambda_context(
    log_event=False, correlation_id_path=correlation_paths.APPSYNC_RESOLVER
)
def handler(event, context: LambdaContext):
    logger.info(
        "Incoming request for " + event["info"]["fieldName"],
        arguments=event["arguments"],
        identify=event["identity"],
    )
    user_roles = event.get("identity", {}).get("claims").get("cognito:groups")

    request = json.loads(event["arguments"]["data"])
    if request.get("applicationId"):
        application_id = request.get("applicationId")
        application_item = get_application(application_id)
        logger.info("Application item 1", applicationItem=application_item)

        app_roles = application_item.get("Roles", [])
        app_roles.append("admin")
        app_roles.append("workspace_namager")

        if not (set(user_roles).intersection(set(app_roles))) and not (
            "admin" in user_roles or "workspace_manager" in user_roles
        ):
            raise RuntimeError("User is not authorized to access this application")
        logger.info("Application item 2", applicationItem=application_item)
        provider = application_item.get("Model").split("::")[0]
        modelName = application_item.get("Model").split("::")[1]
        workspace_value = application_item.get("Workspace")
        allow_images = application_item.get("AllowImageInput")
        allow_videos = application_item.get("AllowVideoInput")
        allow_documents = application_item.get("AllowDocumentInput")
        workspaceId = workspace_value.split("::")[-1] if workspace_value else None

        modelKwargs = {
            "streaming": application_item.get("Streaming", False),
            "maxTokens": int(application_item.get("MaxTokens", 512)),
            "temperature": float(application_item.get("Temperature", 0.6)),
            "topP": float(application_item.get("TopP", 0.9)),
        }
        system_prompts = {
            "systemPrompt": application_item.get("SystemPrompt", ""),
            "systemPromptRag": application_item.get("SystemPromptRag", ""),
            "condenseSystemPrompt": application_item.get("CondenseSystemPrompt", ""),
        }
        message = {
            "action": request["action"],
            "modelInterface": request["modelInterface"],
            "direction": "IN",
            "timestamp": str(int(round(datetime.now().timestamp()))),
            "userId": event["identity"]["sub"],
            "userGroups": user_roles,
            "systemPrompts": system_prompts,
            "data": {
                "mode": request["data"]["mode"] or "chain",
                "text": request["data"]["text"],
                "images": request["data"]["images"] if allow_images else [],
                "videos": request["data"]["videos"] if allow_videos else [],
                "documents": request["data"]["documents"] if allow_documents else [],
                "modelName": modelName,
                "provider": provider,
                "sessionId": request["data"]["sessionId"],
                "workspaceId": workspaceId,
                "modelKwargs": modelKwargs,
            },
        }
    else:
        if not ("admin" in user_roles or "workspace_manager" in user_roles):
            raise RuntimeError("User is not authorized to access this application")
        message = {
            "action": request["action"],
            "modelInterface": request["modelInterface"],
            "direction": "IN",
            "timestamp": str(int(round(datetime.now().timestamp()))),
            "userId": event["identity"]["sub"],
            "userGroups": user_roles,
            "data": request.get("data", {}),
        }
    InputValidation(**message)

    logger.info("Sending message to SNS topic", sns_message=message)
    try:
        InputValidation(**message)
        response = sns.publish(TopicArn=TOPIC_ARN, Message=json.dumps(message))
        return response
    except ValidationError as e:
        errors = e.errors(include_url=False, include_context=False, include_input=False)
        logger.warning("Validation error", errors=errors)
        raise ValueError(f"Invalid request. Details: {errors}")
    except Exception as e:
        # Do not return an unknown exception to the end user.
        logger.exception(e)
        raise RuntimeError("Something went wrong")
