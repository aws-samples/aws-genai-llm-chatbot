import genai_core.types
from .client import get_kendra_client_for_index


def query_workspace_kendra(
    workspace_id: str, workspace: dict, query: str, limit: int, full_response: bool
):
    kendra_index_id = workspace.get("kendra_index_id")
    kendra_index_external = workspace.get("kendra_index_external", True)
    if not kendra_index_id:
        raise genai_core.types.CommonError(
            f"Could not find kendra index for workspace {workspace_id}"
        )

    kendra = get_kendra_client_for_index(kendra_index_id)
    limit = max(1, min(100, limit))

    if kendra_index_external:
        result = kendra.retrieve(
            IndexId=kendra_index_id,
            QueryText=query,
            PageSize=limit,
            PageNumber=1)
    else:
        result = kendra.retrieve(
            IndexId=kendra_index_id,
            QueryText=query,
            PageSize=limit,
            PageNumber=1,
            AttributeFilter={
                "EqualsTo": {
                    "Key": "workspace_id",
                    "Value": {
                        "StringValue": workspace_id,
                    }
                }
            },
        )

    items = result["ResultItems"]

    ret_value = {
        "engine": "kendra",
        "items": [],
    }

    return ret_value
