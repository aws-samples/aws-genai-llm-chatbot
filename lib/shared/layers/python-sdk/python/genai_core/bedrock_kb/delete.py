import os
from aws_lambda_powertools import Logger
import boto3

WORKSPACES_TABLE_NAME = os.environ["WORKSPACES_TABLE_NAME"]
DOCUMENTS_TABLE_NAME = os.environ.get("DOCUMENTS_TABLE_NAME")


WORKSPACE_OBJECT_TYPE = "workspace"

dynamodb = boto3.resource("dynamodb")
logger = Logger()


def delete_workspace(workspace: dict):
    workspace_id = workspace["workspace_id"]

    workspaces_table = dynamodb.Table(WORKSPACES_TABLE_NAME)

    response = workspaces_table.delete_item(
        Key={"workspace_id": workspace_id, "object_type": WORKSPACE_OBJECT_TYPE},
    )

    logger.info(f"Delete Item succeeded: {response}")
