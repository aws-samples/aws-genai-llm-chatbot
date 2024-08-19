import genai_core.types
import genai_core.workspaces
import genai_core.aurora.delete
import genai_core.opensearch.delete
import genai_core.kendra.delete
import genai_core.bedrock_kb.delete
from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.typing import LambdaContext

logger = Logger()


@logger.inject_lambda_context(log_event=True)
def lambda_handler(event, context: LambdaContext):
    workspace_id = event["workspace_id"]
    workspace = genai_core.workspaces.get_workspace(workspace_id)
    if workspace is None:
        raise genai_core.types.CommonError("Workspace not found")

    if workspace["engine"] == "aurora":
        genai_core.aurora.delete.delete_workspace(workspace)
    elif workspace["engine"] == "opensearch":
        genai_core.opensearch.delete.delete_workspace(workspace)
    elif workspace["engine"] == "kendra":
        genai_core.kendra.delete.delete_workspace(workspace)
    elif workspace["engine"] == "bedrock_kb":
        genai_core.bedrock_kb.delete.delete_workspace(workspace)
    else:
        raise genai_core.types.CommonError("Workspace engine not supported")
