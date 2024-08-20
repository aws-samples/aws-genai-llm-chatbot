import os
from aws_lambda_powertools import Logger
import boto3
from botocore.exceptions import BotoCoreError, ClientError
import genai_core.utils.delete_files_with_prefix
import genai_core.utils.delete_files_with_object_key
import genai_core.types
import psycopg2
from psycopg2 import sql
from genai_core.aurora.connection import AuroraConnection
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
    genai_core.utils.delete_files_with_prefix.delete_files_with_prefix(
        UPLOAD_BUCKET_NAME, workspace_id
    )
    genai_core.utils.delete_files_with_prefix.delete_files_with_prefix(
        PROCESSING_BUCKET_NAME, workspace_id
    )

    table_name = sql.Identifier(workspace_id.replace("-", ""))
    with AuroraConnection(autocommit=False) as cursor:
        cursor.execute(
            sql.SQL("DROP TABLE IF EXISTS {table};").format(table=table_name)
        )

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


def delete_aurora_document(workspace_id: str, document: dict):
    table_name = sql.Identifier(workspace_id.replace("-", ""))
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

    deleteAuroraDocument(document_id, table_name)

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
            + "documents :documentsIncrementValue, "
            + "vectors :vectorsIncrementValue SET updated_at=:timestampValue",
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


def deleteAuroraDocument(document_id: str, table_name: str):
    try:
        with AuroraConnection(autocommit=False) as cursor:
            cursor.execute(
                sql.SQL("DELETE FROM {table} WHERE document_id = %s").format(
                    table=table_name
                ),
                (document_id,),
            )
            cursor.connection.commit()
            logger.info(f"Deleted document {document_id} from {table_name}")
    except psycopg2.Error as e:
        logger.error(
            f"An error occurred while deleting document from Aurora table: {e}"
        )
