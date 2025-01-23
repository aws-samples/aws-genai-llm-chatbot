from decimal import Decimal
import os
import uuid
from aws_lambda_powertools import Logger
import boto3
from datetime import datetime
from botocore.exceptions import ClientError
from boto3.dynamodb.conditions import Attr
import genai_core.roles
import genai_core.workspaces
import genai_core.models
import genai_core.types

dynamodb = boto3.resource("dynamodb")
logger = Logger()

APPLICATIONS_TABLE_NAME = os.environ.get("APPLICATIONS_TABLE_NAME")
if APPLICATIONS_TABLE_NAME:
    table = dynamodb.Table(APPLICATIONS_TABLE_NAME)


def list_applications():
    items = []
    try:
        last_evaluated_key = None
        while True:
            if last_evaluated_key:
                response = table.scan(
                    ExclusiveStartKey=last_evaluated_key,
                )
            else:
                response = table.scan()

            items.extend(response.get("Items", []))

            last_evaluated_key = response.get("LastEvaluatedKey")
            if not last_evaluated_key:
                break

    except ClientError as error:
        logger.exception(error)

    return items


def list_applications_by_role(role):
    items = []
    try:
        last_evaluated_key = None
        while True:
            if last_evaluated_key:
                response = table.scan(
                    FilterExpression=Attr("Roles").contains(role),
                    ExclusiveStartKey=last_evaluated_key,
                )
            else:
                response = table.scan(
                    FilterExpression=Attr("Roles").contains(role),
                )

            items.extend(response.get("Items", []))

            last_evaluated_key = response.get("LastEvaluatedKey")
            if not last_evaluated_key:
                break

    except ClientError as error:
        if error.response["Error"]["Code"] == "ResourceNotFoundException":
            logger.warning("No record found for role: %s", role)
        else:
            logger.exception(error)

    return items


def get_application(id: str):
    response = table.get_item(Key={"Id": id})
    item = response.get("Item")

    return item


def create_application(
    name: str,
    model: str,
    workspace: str,
    systemPrompt: str,
    systemPromptRag: str,
    condenseSystemPrompt: str,
    roles: list[str],
    allowImageInput: bool,
    allowVideoInput: bool,
    allowDocumentInput: bool,
    enableGuardrails: bool,
    streaming: bool,
    maxTokens: int,
    temperature: Decimal,
    topP: Decimal,
):
    application_id = str(uuid.uuid4())
    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%fZ")

    validate_request(workspace=workspace, roles=roles, model=model)

    output_modalities = genai_core.models._get_model_modalities(model)
    item = {
        "Id": application_id,
        "Name": name,
        "Model": model,
        "OutputModalities": output_modalities,
        "Workspace": workspace,
        "SystemPrompt": systemPrompt,
        "SystemPromptRag": systemPromptRag,
        "CondenseSystemPrompt": condenseSystemPrompt,
        "Roles": roles,
        "AllowImageInput": allowImageInput,
        "AllowVideoInput": allowVideoInput,
        "AllowDocumentInput": allowDocumentInput,
        "EnableGuardrails": enableGuardrails,
        "Streaming": streaming,
        "MaxTokens": maxTokens,
        "Temperature": temperature,
        "TopP": topP,
        "CreateTime": timestamp,
        "UpdateTime": timestamp,
    }

    ddb_response = table.put_item(Item=item)

    logger.info(
        "Response for create_application",
        ddb_response=ddb_response,
    )

    return item


def update_application(
    id: str,
    name: str,
    model: str,
    workspace: str,
    systemPrompt: str,
    systemPromptRag: str,
    condenseSystemPrompt: str,
    roles: list[str],
    allowImageInput: bool,
    allowVideoInput: bool,
    allowDocumentInput: bool,
    enableGuardrails: bool,
    streaming: bool,
    maxTokens: int,
    temperature: Decimal,
    topP: Decimal,
):
    response = table.get_item(Key={"Id": id})
    if response.get("Item") is None:
        raise genai_core.types.CommonError("Unknown application")

    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%fZ")
    validate_request(workspace=workspace, roles=roles, model=model)
    output_modalities = genai_core.models._get_model_modalities(model)
    item = {
        "Id": id,
        "Name": name,
        "Model": model,
        "OutputModalities": output_modalities,
        "Workspace": workspace,
        "SystemPrompt": systemPrompt,
        "SystemPromptRag": systemPromptRag,
        "ConsiseSystemPrompt": condenseSystemPrompt,
        "Roles": roles,
        "AllowImageInput": allowImageInput,
        "AllowVideoInput": allowVideoInput,
        "AllowDocumentInput": allowDocumentInput,
        "EnableGuardrails": enableGuardrails,
        "Streaming": streaming,
        "MaxTokens": maxTokens,
        "Temperature": temperature,
        "TopP": topP,
        "CreateTime": response.get("Item").get("CreateTime"),
        "UpdateTime": timestamp,
    }

    ddb_response = table.put_item(Item=item)

    logger.info(
        "Response for update_application",
        ddb_response=ddb_response,
    )

    return item


def delete_application(id):
    try:
        table.delete_item(Key={"Id": id})
    except ClientError as error:
        if error.response["Error"]["Code"] == "ResourceNotFoundException":
            logger.warning("No record found with id: %s", id)
        else:
            logger.exception(error)

        return False

    logger.info("Deleted application with id: %s", id)
    return True


def validate_request(workspace, roles, model):
    all_models = genai_core.models.list_models()
    model_found = False
    model_split = model.split("::")
    if len(model_split) != 2:
        raise genai_core.types.CommonError("Model not found")
    for m in all_models:
        if m.get("provider") == model_split[0] and m.get("name") == model_split[1]:
            model_found = True
            break

    if model_found == False:
        raise genai_core.types.CommonError("Model not found")

    all_roles = genai_core.roles.list_roles()
    all_roles_names = list(map(lambda o: o.get("name"), all_roles))
    for role in roles:
        if role not in all_roles_names:
            raise genai_core.types.CommonError("Role not found")

    if workspace is not None and len(workspace) > 0:
        workspace_split = workspace.split("::")
        if len(workspace_split) != 2:
            raise genai_core.types.CommonError("Workspace not found")
        genai_core.workspaces.get_workspace(workspace)

        workspace_found = genai_core.workspaces.get_workspace(workspace_split[1])
        if not workspace_found or workspace_found.get("name") != workspace_split[0]:
            raise genai_core.types.CommonError("Workspace not found")
