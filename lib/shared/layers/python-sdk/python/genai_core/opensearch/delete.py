import os
from aws_lambda_powertools import Logger
import boto3
from botocore.exceptions import BotoCoreError, ClientError
from .client import get_open_search_client
import genai_core.utils.delete_files_with_prefix
import genai_core.utils.delete_files_with_object_key
import genai_core.types
from datetime import datetime


PROCESSING_BUCKET_NAME = os.environ["PROCESSING_BUCKET_NAME"]
UPLOAD_BUCKET_NAME = os.environ["UPLOAD_BUCKET_NAME"]
WORKSPACES_TABLE_NAME = os.environ["WORKSPACES_TABLE_NAME"]
DOCUMENTS_TABLE_NAME = os.environ.get("DOCUMENTS_TABLE_NAME")

WORKSPACE_OBJECT_TYPE = "workspace"

dynamodb = boto3.resource("dynamodb")
logger = Logger()


def delete_workspace(workspace: dict):
    workspace_id = workspace["workspace_id"]
    index_name = workspace_id.replace("-", "")

    genai_core.utils.delete_files_with_prefix.delete_files_with_prefix(
        UPLOAD_BUCKET_NAME, workspace_id
    )
    genai_core.utils.delete_files_with_prefix.delete_files_with_prefix(
        PROCESSING_BUCKET_NAME, workspace_id
    )

    client = get_open_search_client()
    if client.indices.exists(index_name):
        client.indices.delete(index=index_name)
        logger.info(f"Index {index_name} deleted.")

    workspaces_table = dynamodb.Table(WORKSPACES_TABLE_NAME)
    documents_table = dynamodb.Table(DOCUMENTS_TABLE_NAME)

    items_to_delete = []
    last_evaluated_key = None
    while True:
        query_args = {
            "KeyConditionExpression": boto3.dynamodb.conditions.Key("workspace_id").eq(
                workspace_id
            )
        }

        if last_evaluated_key:
            query_args["ExclusiveStartKey"] = last_evaluated_key

        response = documents_table.query(**query_args)
        items_to_delete.extend(response["Items"])

        last_evaluated_key = response.get("LastEvaluatedKey")
        if not last_evaluated_key:
            break

    # Batch delete in groups of 25
    for i in range(0, len(items_to_delete), 25):
        with documents_table.batch_writer() as batch:
            for item in items_to_delete[i : i + 25]:
                batch.delete_item(
                    Key={
                        "workspace_id": item["workspace_id"],
                        "document_id": item["document_id"],
                    }
                )

    logger.info(f"Deleted {len(items_to_delete)} items.")

    response = workspaces_table.delete_item(
        Key={"workspace_id": workspace_id, "object_type": WORKSPACE_OBJECT_TYPE},
    )

    logger.info(f"Delete Item succeeded: {response}")


def delete_open_search_document(workspace_id: str, document: dict):
    index_name = workspace_id.replace("-", "")
    document_id = document["document_id"]
    document_vectors = document["vectors"]
    documents_diff = 1
    document_size_in_bytes = document["size_in_bytes"]
    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%fZ")

    if document["path"]:
        upload_bucket_key = workspace_id + "/" + document["path"]
        genai_core.utils.delete_files_with_object_key.delete_files_with_object_key(
            UPLOAD_BUCKET_NAME, upload_bucket_key
        )

    processing_bucket_key = workspace_id + "/" + document_id

    genai_core.utils.delete_files_with_prefix.delete_files_with_prefix(
        PROCESSING_BUCKET_NAME, processing_bucket_key
    )

    deleteOpenSearchDocument(document_id, index_name)

    documents_table = dynamodb.Table(DOCUMENTS_TABLE_NAME)
    workspaces_table = dynamodb.Table(WORKSPACES_TABLE_NAME)

    try:
        response = documents_table.delete_item(
            Key={
                "workspace_id": workspace_id,
                "document_id": document_id,
            }
        )
        logger.info(f"Delete document succeeded: {response}")

        updateResponse = workspaces_table.update_item(
            Key={"workspace_id": workspace_id, "object_type": WORKSPACE_OBJECT_TYPE},
            UpdateExpression="ADD size_in_bytes :incrementValue, "
            + "documents :documentsIncrementValue, vectors :vectorsIncrementValue "
            + "SET updated_at=:timestampValue",
            ExpressionAttributeValues={
                ":incrementValue": -document_size_in_bytes,
                ":documentsIncrementValue": -documents_diff,
                ":vectorsIncrementValue": -document_vectors,
                ":timestampValue": timestamp,
            },
            ReturnValues="UPDATED_NEW",
        )
        logger.info(f"Workspaces table updated for the document: {updateResponse}")

    except (BotoCoreError, ClientError) as error:
        logger.error(f"An error occurred: {error}")


def deleteOpenSearchDocument(document_id, index_name):
    client = get_open_search_client()
    if client.indices.exists(index_name):
        search_query = {"query": {"match": {"document_id": document_id}}}
        from_ = 0
        batch_size = 100
        while True:
            search_response = client.search(
                index=index_name, body=search_query, from_=from_, size=batch_size
            )

            hits = search_response["hits"]["hits"]
            if not hits:
                break

            for hit in hits:
                client.delete(index=index_name, id=hit["_id"])

            from_ += batch_size

        logger.info(f"Record {document_id} deleted.")
