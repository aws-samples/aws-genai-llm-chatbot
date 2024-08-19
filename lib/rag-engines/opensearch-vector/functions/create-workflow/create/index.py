import genai_core.workspaces
import genai_core.opensearch.create
from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.typing import LambdaContext

logger = Logger()


@logger.inject_lambda_context(log_event=True)
def lambda_handler(event, context: LambdaContext):
    workspace_id = event["workspace_id"]
    logger.info(f"Creating workspace {workspace_id}")

    workspace = genai_core.workspaces.get_workspace(workspace_id)
    if not workspace:
        raise Exception(f"Workspace {workspace_id} does not exist")

    genai_core.opensearch.create.create_workspace_index(workspace)

    return {"ok": True}
