from typing import List, Optional
from .client import get_open_search_client


def add_chunks_open_search(
    workspace_id: str,
    document_id: str,
    document_sub_id: Optional[str],
    document_type: str,
    document_sub_type: Optional[str],
    path: Optional[str],
    title: Optional[str],
    chunk_ids: List[str],
    chunk_embeddings: List[int],
    chunks: List[str],
    chunk_complements: List[str],
    replace: bool,
):
    index_name = workspace_id.replace("-", "")
    complements_len = len(chunk_complements) if chunk_complements else 0
    removed_vectors = 0

    client = get_open_search_client()

    if replace:
        removed_vectors = clean_chunks_open_search(workspace_id, document_id)

    for idx in range(len(chunk_ids)):
        chunk_id = chunk_ids[idx]
        content = chunks[idx]
        content_complement = chunk_complements[idx] if idx < complements_len else None

        add_body = {
            "chunk_id": chunk_id,
            "workspace_id": workspace_id,
            "document_id": document_id,
            "document_sub_id": document_sub_id,
            "document_type": document_type,
            "document_sub_type": document_sub_type,
            "path": path,
            "title": title,
            "content": content,
            "content_complement": content_complement,
            "content_embeddings": chunk_embeddings[idx],
        }

        client.index(index=index_name, body=add_body)

    return {"removed_vectors": removed_vectors, "added_vectors": len(chunk_ids)}


def clean_chunks_open_search(workspace_id: str, document_id: str):
    index_name = workspace_id.replace("-", "")
    client = get_open_search_client()

    query = {
        "query": {
            "bool": {
                "must": [
                    {"term": {"workspace_id": workspace_id}},
                    {"term": {"document_id": document_id}},
                ]
            }
        }
    }

    response = client.search(index=index_name, body=query)
    docs = response["hits"]["hits"]
    removed_vectors = len(docs)

    for doc in docs:
        client.delete(index=index_name, id=doc["_id"], ignore=[400, 404])

    return removed_vectors
