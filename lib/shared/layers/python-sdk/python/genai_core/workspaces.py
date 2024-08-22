import os
import json
import uuid
from aws_lambda_powertools import Logger
import boto3
import genai_core.embeddings
from datetime import datetime
from .types import WorkspaceStatus
from genai_core.types import Task

dynamodb = boto3.resource("dynamodb")
sfn_client = boto3.client("stepfunctions")
logger = Logger()

WORKSPACES_TABLE_NAME = os.environ.get("WORKSPACES_TABLE_NAME")
WORKSPACES_BY_OBJECT_TYPE_INDEX_NAME = os.environ.get(
    "WORKSPACES_BY_OBJECT_TYPE_INDEX_NAME"
)
CREATE_AURORA_WORKSPACE_WORKFLOW_ARN = os.environ.get(
    "CREATE_AURORA_WORKSPACE_WORKFLOW_ARN"
)
CREATE_OPEN_SEARCH_WORKSPACE_WORKFLOW_ARN = os.environ.get(
    "CREATE_OPEN_SEARCH_WORKSPACE_WORKFLOW_ARN"
)
CREATE_KENDRA_WORKSPACE_WORKFLOW_ARN = os.environ.get(
    "CREATE_KENDRA_WORKSPACE_WORKFLOW_ARN"
)
DELETE_WORKSPACE_WORKFLOW_ARN = os.environ.get("DELETE_WORKSPACE_WORKFLOW_ARN")

WORKSPACE_OBJECT_TYPE = "workspace"

if WORKSPACES_TABLE_NAME:
    table = dynamodb.Table(WORKSPACES_TABLE_NAME)


def list_workspaces():
    all_items = []
    last_evaluated_key = None

    while True:
        if last_evaluated_key:
            response = table.query(
                IndexName=WORKSPACES_BY_OBJECT_TYPE_INDEX_NAME,
                KeyConditionExpression=boto3.dynamodb.conditions.Key("object_type").eq(
                    WORKSPACE_OBJECT_TYPE
                ),
                ExclusiveStartKey=last_evaluated_key,
                ScanIndexForward=False,
            )
        else:
            response = table.query(
                IndexName=WORKSPACES_BY_OBJECT_TYPE_INDEX_NAME,
                KeyConditionExpression=boto3.dynamodb.conditions.Key("object_type").eq(
                    WORKSPACE_OBJECT_TYPE
                ),
                ScanIndexForward=False,
            )

        all_items.extend(response["Items"])

        last_evaluated_key = response.get("LastEvaluatedKey")
        if not last_evaluated_key:
            break

    return all_items


def get_workspace(workspace_id: str):
    response = table.get_item(
        Key={"workspace_id": workspace_id, "object_type": WORKSPACE_OBJECT_TYPE}
    )
    item = response.get("Item")

    return item


def set_status(workspace_id: str, status: str):
    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%fZ")

    response = table.update_item(
        Key={"workspace_id": workspace_id, "object_type": WORKSPACE_OBJECT_TYPE},
        UpdateExpression="SET #status=:status, updated_at=:timestampValue",
        ExpressionAttributeNames={
            "#status": "status",
        },
        ExpressionAttributeValues={
            ":status": status,
            ":timestampValue": timestamp,
        },
    )

    return response


def create_workspace_aurora(
    workspace_name: str,
    embeddings_model_provider: str,
    embeddings_model_name: str,
    embeddings_model_dimensions: int,
    cross_encoder_model_provider: str,
    cross_encoder_model_name: str,
    languages: list[str],
    metric: str,
    has_index: bool,
    hybrid_search: bool,
    chunking_strategy: str,
    chunk_size: int,
    chunk_overlap: int,
):
    workspace_id = str(uuid.uuid4())
    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%fZ")

    embeddings_model = genai_core.embeddings.get_embeddings_model(
        embeddings_model_provider, embeddings_model_name
    )
    if not embeddings_model:
        raise genai_core.types.CommonError("Invalid embeddings model")
    # Verify that the embeddings model
    genai_core.embeddings.generate_embeddings(embeddings_model, ["test"], Task.STORE)

    item = {
        "workspace_id": workspace_id,
        "object_type": WORKSPACE_OBJECT_TYPE,
        "format_version": 1,
        "name": workspace_name,
        "engine": "aurora",
        "status": WorkspaceStatus.SUBMITTED.value,
        "embeddings_model_provider": embeddings_model_provider,
        "embeddings_model_name": embeddings_model_name,
        "embeddings_model_dimensions": embeddings_model_dimensions,
        "cross_encoder_model_provider": cross_encoder_model_provider,
        "cross_encoder_model_name": cross_encoder_model_name,
        "languages": languages,
        "metric": metric,
        "has_index": has_index,
        "hybrid_search": hybrid_search,
        "chunking_strategy": chunking_strategy,
        "chunk_size": chunk_size,
        "chunk_overlap": chunk_overlap,
        "documents": 0,
        "vectors": 0,
        "size_in_bytes": 0,
        "created_at": timestamp,
        "updated_at": timestamp,
    }

    ddb_response = table.put_item(Item=item)

    response = sfn_client.start_execution(
        stateMachineArn=CREATE_AURORA_WORKSPACE_WORKFLOW_ARN,
        input=json.dumps(
            {
                "workspace_id": workspace_id,
            }
        ),
    )

    logger.info(
        "Response for create_workspace_aurora",
        response=response,
        ddb_response=ddb_response,
    )

    return item


def create_workspace_open_search(
    workspace_name: str,
    embeddings_model_provider: str,
    embeddings_model_name: str,
    embeddings_model_dimensions: int,
    cross_encoder_model_provider: str,
    cross_encoder_model_name: str,
    languages: list[str],
    hybrid_search: bool,
    chunking_strategy: str,
    chunk_size: int,
    chunk_overlap: int,
):
    workspace_id = str(uuid.uuid4())
    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%fZ")

    embeddings_model = genai_core.embeddings.get_embeddings_model(
        embeddings_model_provider, embeddings_model_name
    )
    if not embeddings_model:
        raise genai_core.types.CommonError("Invalid embeddings model")
    # Verify that the embeddings model
    genai_core.embeddings.generate_embeddings(embeddings_model, ["test"], Task.STORE)

    item = {
        "workspace_id": workspace_id,
        "object_type": WORKSPACE_OBJECT_TYPE,
        "format_version": 1,
        "name": workspace_name,
        "engine": "opensearch",
        "status": WorkspaceStatus.SUBMITTED.value,
        "embeddings_model_provider": embeddings_model_provider,
        "embeddings_model_name": embeddings_model_name,
        "embeddings_model_dimensions": embeddings_model_dimensions,
        "cross_encoder_model_provider": cross_encoder_model_provider,
        "cross_encoder_model_name": cross_encoder_model_name,
        "languages": languages,
        "metric": "l2",
        "aoss_engine": "nmslib",
        "hybrid_search": hybrid_search,
        "chunking_strategy": chunking_strategy,
        "chunk_size": chunk_size,
        "chunk_overlap": chunk_overlap,
        "documents": 0,
        "vectors": 0,
        "size_in_bytes": 0,
        "created_at": timestamp,
        "updated_at": timestamp,
    }

    ddb_response = table.put_item(Item=item)

    response = sfn_client.start_execution(
        stateMachineArn=CREATE_OPEN_SEARCH_WORKSPACE_WORKFLOW_ARN,
        input=json.dumps(
            {
                "workspace_id": workspace_id,
            }
        ),
    )

    logger.info(
        "Response for create_workspace_open_search",
        response=response,
        ddb_response=ddb_response,
    )

    return item


def create_workspace_kendra(
    workspace_name: str, kendra_index: dict, use_all_data: bool
):
    workspace_id = str(uuid.uuid4())
    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%fZ")
    kendra_index_id = kendra_index["id"]
    kendra_index_external = kendra_index["external"]
    use_all_data = use_all_data if not kendra_index_external else True

    item = {
        "workspace_id": workspace_id,
        "object_type": WORKSPACE_OBJECT_TYPE,
        "format_version": 1,
        "name": workspace_name,
        "engine": "kendra",
        "status": WorkspaceStatus.SUBMITTED.value,
        "kendra_index_id": kendra_index_id,
        "kendra_index_external": kendra_index_external,
        "kendra_use_all_data": use_all_data,
        "documents": 0,
        "vectors": 0,
        "size_in_bytes": 0,
        "created_at": timestamp,
        "updated_at": timestamp,
    }

    ddb_response = table.put_item(Item=item)

    response = sfn_client.start_execution(
        stateMachineArn=CREATE_KENDRA_WORKSPACE_WORKFLOW_ARN,
        input=json.dumps(
            {
                "workspace_id": workspace_id,
            }
        ),
    )

    logger.info(
        "Response for create_workspace_kendra",
        response=response,
        ddb_response=ddb_response,
    )

    return item


def create_workspace_bedrock_kb(
    workspace_name: str, knowledge_base: dict, hybrid_search: bool
):
    workspace_id = str(uuid.uuid4())
    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%fZ")
    knowledge_base_id = knowledge_base["id"]
    external = knowledge_base["external"]

    item = {
        "workspace_id": workspace_id,
        "object_type": WORKSPACE_OBJECT_TYPE,
        "format_version": 1,
        "name": workspace_name,
        "engine": "bedrock_kb",
        "status": WorkspaceStatus.READY.value,
        "knowledge_base_id": knowledge_base_id,
        "knowledge_base_external": external,
        "hybrid_search": hybrid_search,
        "documents": 0,
        "vectors": 0,
        "size_in_bytes": 0,
        "created_at": timestamp,
        "updated_at": timestamp,
    }

    response = table.put_item(Item=item)
    logger.info("Response for create_workspace_bedrock_kb", response=response)

    return item


def delete_workspace(workspace_id: str):
    response = table.get_item(
        Key={"workspace_id": workspace_id, "object_type": WORKSPACE_OBJECT_TYPE}
    )

    item = response.get("Item")

    if not item:
        raise genai_core.types.CommonError("Workspace not found")

    if item["status"] != "ready" and item["status"] != "error":
        raise genai_core.types.CommonError("Workspace not ready for deletion")

    response = sfn_client.start_execution(
        stateMachineArn=DELETE_WORKSPACE_WORKFLOW_ARN,
        input=json.dumps(
            {
                "workspace_id": workspace_id,
            }
        ),
    )

    logger.info("Response for delete_workspace", response=response)
