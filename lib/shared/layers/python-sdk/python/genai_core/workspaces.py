import os
import json
import uuid
import boto3
from datetime import datetime
from aws_lambda_powertools import Logger

logger = Logger()
dynamodb = boto3.resource("dynamodb")
sfn_client = boto3.client("stepfunctions")

WORKSPACES_TABLE_NAME = os.environ["WORKSPACES_TABLE_NAME"]
WORKSPACES_BY_OBJECT_TYPE_INDEX_NAME = os.environ[
    "WORKSPACES_BY_OBJECT_TYPE_INDEX_NAME"
]
CREATE_AURORA_WORKSPACE_WORKFLOW_ARN = os.environ.get(
    "CREATE_AURORA_WORKSPACE_WORKFLOW_ARN"
)
CREATE_OPEN_SEARCH_WORKSPACE_WORKFLOW_ARN = os.environ.get(
    "CREATE_OPEN_SEARCH_WORKSPACE_WORKFLOW_ARN"
)
CREATE_KENDRA_WORKSPACE_WORKFLOW_ARN = os.environ.get(
    "CREATE_KENDRA_WORKSPACE_WORKFLOW_ARN"
)

WORKSPACE_OBJECT_TYPE = "workspace"

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

    item = {
        "workspace_id": workspace_id,
        "object_type": WORKSPACE_OBJECT_TYPE,
        "format_version": 1,
        "name": workspace_name,
        "engine": "aurora",
        "status": "submitted",
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

    response = table.put_item(Item=item)
    logger.info(response)

    response = sfn_client.start_execution(
        stateMachineArn=CREATE_AURORA_WORKSPACE_WORKFLOW_ARN,
        input=json.dumps(
            {
                "workspace_id": workspace_id,
            }
        ),
    )

    logger.info(response)

    return {
        "id": workspace_id,
    }


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

    item = {
        "workspace_id": workspace_id,
        "object_type": WORKSPACE_OBJECT_TYPE,
        "format_version": 1,
        "name": workspace_name,
        "engine": "opensearch",
        "status": "submitted",
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

    response = table.put_item(Item=item)
    logger.info(response)

    response = sfn_client.start_execution(
        stateMachineArn=CREATE_OPEN_SEARCH_WORKSPACE_WORKFLOW_ARN,
        input=json.dumps(
            {
                "workspace_id": workspace_id,
            }
        ),
    )

    logger.info(response)

    return {
        "id": workspace_id,
    }


def create_workspace_kendra(workspace_name: str, kendra_index: dict):
    workspace_id = str(uuid.uuid4())
    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%fZ")
    kendra_index_id = kendra_index["id"]
    kendra_index_external = kendra_index["external"]

    item = {
        "workspace_id": workspace_id,
        "object_type": WORKSPACE_OBJECT_TYPE,
        "format_version": 1,
        "name": workspace_name,
        "engine": "kendra",
        "status": "submitted",
        "kendra_index_id": kendra_index_id,
        "kendra_index_external": kendra_index_external,
        "documents": 0,
        "vectors": 0,
        "size_in_bytes": 0,
        "created_at": timestamp,
        "updated_at": timestamp,
    }

    response = table.put_item(Item=item)
    logger.info(response)

    response = sfn_client.start_execution(
        stateMachineArn=CREATE_KENDRA_WORKSPACE_WORKFLOW_ARN,
        input=json.dumps(
            {
                "workspace_id": workspace_id,
            }
        ),
    )

    logger.info(response)

    return {
        "id": workspace_id,
    }
