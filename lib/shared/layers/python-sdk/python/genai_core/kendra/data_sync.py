import os
import genai_core.types
import genai_core.workspaces
from aws_lambda_powertools import Logger
from .client import get_kendra_client_for_index

logger = Logger()

DEFAULT_KENDRA_S3_DATA_SOURCE_ID = os.environ.get("DEFAULT_KENDRA_S3_DATA_SOURCE_ID")


def start_kendra_data_sync(workspace_id: str):
    workspace = genai_core.workspaces.get_workspace(workspace_id=workspace_id)

    if not workspace:
        raise genai_core.types.CommonError(f"Workspace {workspace_id} not found")

    if workspace["engine"] != "kendra":
        raise genai_core.types.CommonError(
            f"Workspace {workspace_id} is not a kendra workspace"
        )

    if workspace["kendra_index_external"]:
        raise genai_core.types.CommonError(
            f"Workspace {workspace_id} is an external kendra workspace"
        )

    kendra_index_id = workspace["kendra_index_id"]
    kendra = get_kendra_client_for_index(kendra_index_id)

    response = kendra.start_data_source_sync_job(
        Id=DEFAULT_KENDRA_S3_DATA_SOURCE_ID, IndexId=kendra_index_id
    )

    logger.info(response)
