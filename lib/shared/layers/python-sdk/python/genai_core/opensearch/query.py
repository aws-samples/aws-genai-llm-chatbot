import genai_core.embeddings
import genai_core.cross_encoder
from typing import List
from .client import get_open_search_client
from aws_lambda_powertools import Logger
from genai_core.types import CommonError, Task

logger = Logger()


def query_workspace_open_search(
    workspace_id: str,
    workspace: dict,
    query: str,
    limit: int,
    full_response: bool,
    threshold: float = 0.0,
):
    index_name = workspace_id.replace("-", "")

    embeddings_model_provider = workspace["embeddings_model_provider"]
    embeddings_model_name = workspace["embeddings_model_name"]
    cross_encoder_model_provider = workspace["cross_encoder_model_provider"]
    cross_encoder_model_name = workspace["cross_encoder_model_name"]
    hybrid_search = workspace["hybrid_search"]
    languages = workspace["languages"]
    vector_search_limit = 25
    keyword_search_limit = 25

    vector_search_records = []
    keyword_search_records = []

    selected_model = genai_core.embeddings.get_embeddings_model(
        embeddings_model_provider, embeddings_model_name
    )

    if selected_model is None:
        raise CommonError("Embeddings model not found")

    query_embeddings = genai_core.embeddings.generate_embeddings(
        selected_model, [query], Task.RETRIEVE
    )[0]

    items = []

    client = get_open_search_client()
    vector_search_records = vector_query(
        client, index_name, query_embeddings, vector_search_limit
    )
    vector_search_records = _convert_records("vector_search", vector_search_records)
    items.extend(vector_search_records)

    if hybrid_search:
        keyword_search_records = keyword_query(
            client, index_name, query, keyword_search_limit
        )

        keyword_search_records = _convert_records(
            "keyword_search", keyword_search_records
        )
        items.extend(keyword_search_records)

    unique_items = dict({})
    for item in items:
        chunk_id = item["chunk_id"]

        if chunk_id not in unique_items:
            unique_items[chunk_id] = item
        else:
            current = unique_items[chunk_id]
            for source in item["sources"]:
                if source not in current["sources"]:
                    current["sources"].append(source)
            current["sources"] = sorted(current["sources"])

            for source in current["sources"]:
                if source not in item["sources"]:
                    item["sources"].append(source)
            item["sources"] = sorted(item["sources"])

            if current["vector_search_score"] is None:
                current["vector_search_score"] = item["vector_search_score"]
            if current["keyword_search_score"] is None:
                current["keyword_search_score"] = item["keyword_search_score"]

            if item["vector_search_score"] is None:
                item["vector_search_score"] = current["vector_search_score"]
            if item["keyword_search_score"] is None:
                item["keyword_search_score"] = current["keyword_search_score"]

    unique_items = list(unique_items.values())

    if cross_encoder_model_name is not None:
        cross_encoder_model = genai_core.cross_encoder.get_cross_encoder_model(
            cross_encoder_model_provider, cross_encoder_model_name
        )

        if cross_encoder_model is None:
            raise genai_core.types.CommonError("Cross encoder model not found")

        score_dict = dict({})
        if len(unique_items) > 0:
            passages = [record["content"] for record in unique_items]
            passage_scores = genai_core.cross_encoder.rank_passages(
                cross_encoder_model, query, passages
            )

            for i in range(len(unique_items)):
                score = passage_scores[i]
                unique_items[i]["score"] = score
                score_dict[unique_items[i]["chunk_id"]] = score
        unique_items = sorted(unique_items, key=lambda x: x["score"], reverse=True)

        for record in vector_search_records:
            record["score"] = score_dict[record["chunk_id"]]
        for record in keyword_search_records:
            record["score"] = score_dict[record["chunk_id"]]

    if full_response:
        unique_items = unique_items[:limit]
        ret_value = {
            "engine": "opensearch",
            "supported_languages": languages,
            "items": unique_items,
            "vector_search_metric": "l2",
            "vector_search_items": vector_search_records,
            "keyword_search_items": keyword_search_records,
        }
    else:
        if cross_encoder_model_name is not None:
            ret_items = list(
                filter(lambda val: val["score"] > threshold, unique_items)
            )[:limit]
        else:
            ret_items = unique_items[:limit]

        if len(ret_items) < limit and len(unique_items) > len(ret_items):
            unique_items = list(
                filter(
                    lambda record: record["chunk_id"]
                    not in [r["chunk_id"] for r in ret_items],
                    unique_items,
                )
            )
            unique_items = sorted(
                unique_items, key=lambda x: x["vector_search_score"] or -1, reverse=True
            )
            ret_items = ret_items + (
                list(
                    filter(
                        lambda val: (val["vector_search_score"] or -1) > 0.5,
                        unique_items,
                    )
                )[: (limit - len(ret_items))]
            )

        ret_value = {
            "engine": "opensearch",
            "supported_languages": languages,
            "items": ret_items,
        }

    logger.info(ret_value)

    return ret_value


def _convert_records(source: str, records: List[dict]):
    converted_records = []

    for record in records:
        current = record["_source"]
        current_score = record["_score"]

        converted = {
            "chunk_id": current.get("chunk_id"),
            "workspace_id": current.get("workspace_id"),
            "document_id": current.get("document_id"),
            "document_sub_id": current.get("document_sub_id"),
            "document_type": current.get("document_type"),
            "document_sub_type": current.get("document_sub_type"),
            "path": current.get("path"),
            "language": current.get("language"),
            "title": current.get("title"),
            "content": current.get("content"),
            "content_complement": current.get("content_complement"),
            "metadata": current.get("metadata"),
            "sources": [source],
            "score": None,
        }

        if source == "vector_search":
            converted["vector_search_score"] = current_score
            converted["keyword_search_score"] = None
        elif source == "keyword_search":
            converted["keyword_search_score"] = current_score
            converted["vector_search_score"] = None
        else:
            raise CommonError("Unknown source")

        converted_records.append(converted)

    return converted_records


def vector_query(client, index_name: str, vector: List[float], size: int = 25):
    query = {"query": {"knn": {"content_embeddings": {"vector": vector, "k": 5}}}}

    response = client.search(index=index_name, body=query, size=size)

    ret_value = response["hits"]["hits"]
    ret_value = ret_value if ret_value is not None else []

    return ret_value


def keyword_query(client, index_name: str, text: str, size: int = 25):
    query = {"query": {"match": {"content": text}}}

    response = client.search(index=index_name, body=query, size=size)

    ret_value = response["hits"]["hits"]
    ret_value = ret_value if ret_value is not None else []

    return ret_value
