import os
import genai_core.types
from typing import List
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
            IndexId=kendra_index_id, QueryText=query, PageSize=limit, PageNumber=1
        )
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
                    },
                }
            },
        )

    items = result["ResultItems"]
    items = _convert_records("kendra", workspace_id, items)

    ret_value = {
        "engine": "kendra",
        "items": items,
    }

    return ret_value


def _convert_records(source: str, workspace_id: str, records: List[dict]):
    converted_records = []
    for record in records:
        document_uri = record["DocumentURI"]
        path = os.path.basename(document_uri)
        title = record.get("DocumentTitle")
        content = record.get("Content")

        document_attributes = record.get("DocumentAttributes", [])
        document_type = None
        for attribute in document_attributes:
            if attribute["Key"] == "document_type":
                document_type = attribute["Value"]["StringValue"]

        converted = {
            "chunk_id": record.get("Id"),
            "workspace_id": workspace_id,
            "document_id": record.get("DocumentId"),
            "document_sub_id": None,
            "document_type": document_type,
            "document_sub_type": None,
            "path": path,
            "language": None,
            "title": title,
            "content": content,
            "content_complement": None,
            "metadata": None,
            "sources": [source],
            "score": None,
        }

        converted_records.append(converted)

    return converted_records
