import os
import boto3
import genai_core.utils.delete_files_with_prefix
from psycopg2 import sql
from genai_core.aurora.connection import AuroraConnection
import genai_core.workspaces

PROCESSING_BUCKET_NAME = os.environ["PROCESSING_BUCKET_NAME"]
UPLOAD_BUCKET_NAME = os.environ["UPLOAD_BUCKET_NAME"]
WORKSPACES_TABLE_NAME = os.environ["WORKSPACES_TABLE_NAME"]
WORKSPACES_POLICY_TABLE_NAME = os.environ["WORKSPACES_POLICY_TABLE_NAME"]
DOCUMENTS_TABLE_NAME = os.environ.get("DOCUMENTS_TABLE_NAME")

WORKSPACE_OBJECT_TYPE = "workspace"

dynamodb = boto3.resource("dynamodb")


def delete_aurora_workspace(workspace: dict):
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
    documents_policy_table = dynamodb.Table(WORKSPACES_POLICY_TABLE_NAME)

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
    print(f"Deleted {len(items_to_delete)} items.")

    response = workspaces_table.delete_item(
        Key={"workspace_id": workspace_id, "object_type": WORKSPACE_OBJECT_TYPE},
    )

    # Delete all workspace policy related to the current deletion workspace
    items_policy_to_delete = genai_core.workspaces.list_policy_workspace_by_id(workspace_id)
    # Batch delete in groups of 25
    for i in range(0, len(items_policy_to_delete), 25):
        with documents_policy_table.batch_writer() as batch:
            for item in items_policy_to_delete[i : i + 25]:
                batch.delete_item(
                    Key={
                        "pk": item["pk"],
                        "sk": item["sk"],
                    }
                )

    print(f"Deleted {len(items_policy_to_delete)} policy items.")

def delete_aurora_document(document: dict):
    workspace_id = document["workspace_id"]
    table_name = sql.Identifier(workspace_id.replace("-", ""))
    documents_table = dynamodb.Table(DOCUMENTS_TABLE_NAME)

    #Delete document from S3 bucket storage
    genai_core.utils.delete_files_with_prefix.delete_files_with_prefix(
        UPLOAD_BUCKET_NAME, f"{workspace_id}/{document['path']}"
    )
    print(f"Delete all document from Bucket : {UPLOAD_BUCKET_NAME}  belongs to document_id = {document['document_id']}")

    genai_core.utils.delete_files_with_prefix.delete_files_with_prefix(
        PROCESSING_BUCKET_NAME, f"{workspace_id}/{document['document_id']}"
    )
    print(f"Delete all document from Bucket : {PROCESSING_BUCKET_NAME}  belongs to document_id = {document['document_id']}")

    #Delete all vectors belongs to document from Aurora
    with AuroraConnection(autocommit=False) as cursor:
        cursor.execute(
            sql.SQL("DELETE FROM {table} WHERE {field}=%s").format(table=table_name, field=sql.Identifier('document_id')),
            [document['document_id']]
        )

    print('Delete all vector belongs to document_id = ' + document['document_id'])

    #Delete document from document table
    response = documents_table.delete_item(
        Key={"workspace_id": workspace_id, "document_id": document['document_id']},
    )

    print(f"Deleted {document['document_id']} item.")