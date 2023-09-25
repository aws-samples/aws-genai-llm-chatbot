from aws_lambda_powertools import Logger

logger = Logger()


def create_workspace_index(workspace: dict):
    workspace_id = workspace["workspace_id"]
    index_name = workspace_id.replace("-", "")
