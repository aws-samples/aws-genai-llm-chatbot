import re
import genai_core.types
from typing import List
from .client import get_kb_runtime_client_for_id

s3_pattern = re.compile(r"(s3-|s3\.)?(.*)\.amazonaws\.com")


def query_workspace_bedrock_kb(
    workspace_id: str, workspace: dict, query: str, limit: int, full_response: bool
):
    knowledge_base_id = workspace.get("knowledge_base_id")
    search_type = "HYBRID" if workspace.get("hybrid_search", False) else "SEMANTIC"

    if not knowledge_base_id:
        raise genai_core.types.CommonError(
            "Could not find Amazon Bedrock KnowledgeBase"
            + f" ID for workspace {workspace_id}"
        )

    client = get_kb_runtime_client_for_id(knowledge_base_id)
    limit = max(1, min(100, limit))

    result = client.retrieve(
        knowledgeBaseId=knowledge_base_id,
        retrievalQuery={"text": query},
        retrievalConfiguration={
            "vectorSearchConfiguration": {
                "numberOfResults": limit,
                "overrideSearchType": search_type,
            }
        },
    )

    items = result["retrievalResults"]
    items = _convert_records("bedrock_kb", workspace_id, items)

    ret_value = {
        "engine": "bedrock_kb",
        "items": items,
    }

    return ret_value


def _convert_records(source: str, workspace_id: str, records: List[dict]):
    converted_records = []
    _id = 0
    for record in records:
        path = record.get("location", {}).get("s3Location", {}).get("uri", "")
        content = record.get("content", {}).get("text", "")
        score = record.get("score", 0)

        converted = {
            "chunk_id": str(_id),
            "workspace_id": workspace_id,
            "document_id": "",
            "document_sub_id": None,
            "document_type": "object",
            "document_sub_type": None,
            "path": path,
            "language": None,
            "title": "",
            "content": content,
            "content_complement": None,
            "metadata": None,
            "sources": [source],
            "vector_search_score": score,
            "score": None,
        }
        _id += 1
        converted_records.append(converted)

    return converted_records
