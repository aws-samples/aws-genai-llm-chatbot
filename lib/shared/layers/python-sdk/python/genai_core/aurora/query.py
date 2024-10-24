import numpy as np
import genai_core.embeddings
import genai_core.cross_encoder
import genai_core.utils.comprehend
from typing import List
from psycopg2 import sql
from genai_core.aurora.connection import AuroraConnection
from genai_core.aurora.utils import convert_types
from aws_lambda_powertools import Logger
from genai_core.types import CommonError, Task

logger = Logger()


def query_workspace_aurora(
    workspace_id: str,
    workspace: dict,
    query: str,
    limit: int,
    full_response: bool,
    threshold: int = 0,
):
    table_name = sql.Identifier(workspace_id.replace("-", ""))
    embeddings_model_provider = workspace["embeddings_model_provider"]
    embeddings_model_name = workspace["embeddings_model_name"]
    cross_encoder_model_provider = workspace["cross_encoder_model_provider"]
    cross_encoder_model_name = workspace["cross_encoder_model_name"]
    metric = workspace["metric"]
    hybrid_search = workspace["hybrid_search"]
    languages = workspace["languages"]
    vector_search_limit = 25
    keyword_search_limit = 25

    selected_model = genai_core.embeddings.get_embeddings_model(
        embeddings_model_provider, embeddings_model_name
    )

    if selected_model is None:
        raise CommonError("Embeddings model not found")

    query_embeddings = genai_core.embeddings.generate_embeddings(
        selected_model, [query], Task.RETRIEVE
    )[0]

    language_name, detected_languages = genai_core.utils.comprehend.get_query_language(
        query, languages
    )

    items = []
    vector_search_records = []
    keyword_search_records = []
    with AuroraConnection() as cursor:
        if metric == "cosine":
            cursor.execute(
                sql.SQL(
                    """SELECT chunk_id,
                        workspace_id,
                        document_id,
                        document_sub_id,
                        document_type,
                        document_sub_type,
                        path,
                        language,
                        title,
                        content,
                        content_complement,
                        metadata,
                        content_embeddings <=> %s AS vector_search_score
                FROM {table} ORDER BY vector_search_score LIMIT %s;"""
                ).format(table=table_name),
                [np.array(query_embeddings), vector_search_limit],
            )
        elif metric == "l2":
            cursor.execute(
                sql.SQL(
                    """SELECT chunk_id,
                        workspace_id,
                        document_id,
                        document_sub_id,
                        document_type,
                        document_sub_type,
                        path,
                        language,
                        title,
                        content,
                        content_complement,
                        metadata,
                        content_embeddings <-> %s AS vector_search_score
                FROM {table} ORDER BY vector_search_score LIMIT %s;"""
                ).format(table=table_name),
                [np.array(query_embeddings), vector_search_limit],
            )
        elif metric == "inner":
            cursor.execute(
                sql.SQL(
                    """SELECT chunk_id,
                        workspace_id,
                        document_id,
                        document_sub_id,
                        document_type,
                        document_sub_type,
                        path,
                        language,
                        title,
                        content,
                        content_complement,
                        metadata,
                        content_embeddings <#> %s AS vector_search_score
                FROM {table} ORDER BY vector_search_score LIMIT %s;"""
                ).format(table=table_name),
                [np.array(query_embeddings), vector_search_limit],
            )
        else:
            raise Exception("Unknown metric")

        vector_search_records = cursor.fetchall()
        vector_search_records = _convert_records("vector_search", vector_search_records)
        items.extend(vector_search_records)

        if hybrid_search:
            language = sql.Identifier(language_name)

            cursor.execute(
                sql.SQL(
                    """SELECT chunk_id,
                            workspace_id,
                            document_id,
                            document_sub_id,
                            document_type,
                            document_sub_type,
                            path,
                            language,
                            title,
                            content,
                            content_complement,
                            metadata,
                            ts_rank_cd(to_tsvector('{language}', content), query) AS keyword_search_score
                            FROM {table},
                            plainto_tsquery('{language}', %s) query
                            WHERE to_tsvector('{language}', content) @@ query
                            ORDER BY keyword_search_score DESC
                            LIMIT %s;"""  # noqa:E501
                ).format(table=table_name, language=language),
                [query, keyword_search_limit],
            )

            keyword_search_records = cursor.fetchall()
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
            "engine": "aurora",
            "query_language": language_name,
            "supported_languages": languages,
            "detected_languages": detected_languages,
            "items": convert_types(unique_items),
            "vector_search_metric": metric,
            "vector_search_items": convert_types(vector_search_records),
            "keyword_search_items": convert_types(keyword_search_records),
        }
    else:
        if cross_encoder_model_name is not None:
            ret_items = list(
                filter(lambda val: val["score"] > threshold, unique_items)
            )[:limit]
        else:
            ret_items = unique_items[:limit]

        if len(ret_items) < limit:
            # inner product metric is negative hence we sort ascending
            if metric == "inner":
                unique_items = sorted(
                    unique_items,
                    key=lambda x: x["vector_search_score"] or 1,
                    reverse=False,
                )
                ret_items = ret_items + (
                    list(
                        filter(
                            lambda val: (val["vector_search_score"] or 1) < -0.5,
                            unique_items,
                        )
                    )[: (limit - len(ret_items))]
                )
            else:
                unique_items = sorted(
                    unique_items,
                    key=lambda x: x["vector_search_score"] or -1,
                    reverse=True,
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
            "engine": "aurora",
            "query_language": language_name,
            "supported_languages": languages,
            "detected_languages": detected_languages,
            "items": convert_types(ret_items),
        }

    logger.debug(ret_value)

    return ret_value


def _convert_records(source: str, records: List[dict]):
    converted_records = []
    for record in records:
        converted = {
            "chunk_id": record[0],
            "workspace_id": record[1],
            "document_id": record[2],
            "document_sub_id": record[3],
            "document_type": record[4],
            "document_sub_type": record[5],
            "path": record[6],
            "language": record[7],
            "title": record[8],
            "content": record[9],
            "content_complement": record[10],
            "metadata": record[11],
            "sources": [source],
            "score": None,
        }

        if source == "vector_search":
            converted["vector_search_score"] = record[12]
            converted["keyword_search_score"] = None
        elif source == "keyword_search":
            converted["keyword_search_score"] = record[12]
            converted["vector_search_score"] = None
        else:
            raise CommonError("Unknown source")

        converted_records.append(converted)

    return converted_records
