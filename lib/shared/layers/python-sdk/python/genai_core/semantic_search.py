import genai_core.types
import genai_core.workspaces
import genai_core.embeddings
from genai_core.aurora import query_workspace_aurora
from genai_core.opensearch import query_workspace_open_search
from genai_core.kendra import query_workspace_kendra
from genai_core.bedrock_kb import query_workspace_bedrock_kb


def semantic_search(
    workspace_id: str, query: str, limit: int = 5, full_response: bool = False
):
    workspace = genai_core.workspaces.get_workspace(workspace_id)

    if not workspace:
        raise genai_core.types.CommonError("Workspace not found")

    if workspace["status"] != "ready":
        raise genai_core.types.CommonError("Workspace is not ready")

    if workspace["engine"] == "aurora":
        return query_workspace_aurora(
            workspace_id, workspace, query, limit, full_response
        )
    elif workspace["engine"] == "opensearch":
        return query_workspace_open_search(
            workspace_id, workspace, query, limit, full_response
        )
    elif workspace["engine"] == "kendra":
        return query_workspace_kendra(
            workspace_id, workspace, query, limit, full_response
        )
    elif workspace["engine"] == "bedrock_kb":
        return query_workspace_bedrock_kb(
            workspace_id, workspace, query, limit, full_response
        )

    raise genai_core.types.CommonError(
        "Semantic search is not supported for this workspace"
    )
