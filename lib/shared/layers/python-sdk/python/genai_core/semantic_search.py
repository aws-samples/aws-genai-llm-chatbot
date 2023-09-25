import genai_core.types
import genai_core.workspaces
import genai_core.embeddings
from genai_core.aurora import query_workspace_aurora


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

    raise genai_core.types.CommonError(
        "Semantic search is not supported for this workspace"
    )
