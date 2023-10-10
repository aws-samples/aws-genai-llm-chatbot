import os
import boto3
import genai_core.utils.delete_files_with_prefix

PROCESSING_BUCKET_NAME = os.environ["PROCESSING_BUCKET_NAME"]
UPLOAD_BUCKET_NAME = os.environ["UPLOAD_BUCKET_NAME"]
WORKSPACES_TABLE_NAME = os.environ["WORKSPACES_TABLE_NAME"]
DOCUMENTS_TABLE_NAME = os.environ.get("DOCUMENTS_TABLE_NAME")
DEFAULT_KENDRA_S3_DATA_SOURCE_BUCKET_NAME = os.environ.get(
    "DEFAULT_KENDRA_S3_DATA_SOURCE_BUCKET_NAME"
)

WORKSPACE_OBJECT_TYPE = "workspace"

dynamodb = boto3.resource("dynamodb")


def delete_kendra_workspace(workspace: dict):
    workspace_id = workspace["workspace_id"]
    genai_core.utils.delete_files_with_prefix.delete_files_with_prefix(
        UPLOAD_BUCKET_NAME, workspace_id
    )
    genai_core.utils.delete_files_with_prefix.delete_files_with_prefix(
        PROCESSING_BUCKET_NAME, workspace_id
    )
    genai_core.utils.delete_files_with_prefix.delete_files_with_prefix(
        DEFAULT_KENDRA_S3_DATA_SOURCE_BUCKET_NAME, f"documents/{workspace_id}"
    )
    genai_core.utils.delete_files_with_prefix.delete_files_with_prefix(
        DEFAULT_KENDRA_S3_DATA_SOURCE_BUCKET_NAME, f"metadata/documents/{workspace_id}"
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

    print(f"Deleted {len(items_to_delete)} items.")

    response = workspaces_table.delete_item(
        Key={"workspace_id": workspace_id, "object_type": WORKSPACE_OBJECT_TYPE},
    )

    print(f"Delete Item succeeded: {response}")
