from psycopg2 import sql
from typing import List, Optional
from genai_core.aurora.connection import AuroraConnection


def add_chunks_aurora(
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
    table_name = sql.Identifier(workspace_id.replace("-", ""))
    complements_len = len(chunk_complements) if chunk_complements else 0
    removed_vectors = 0

    with AuroraConnection(autocommit=False) as cursor:
        if replace:
            cursor.execute(
                sql.SQL(
                    """DELETE FROM {table} WHERE
                        workspace_id = %s AND document_id = %s;"""
                ).format(table=table_name),
                [workspace_id, document_id],
            )

            removed_vectors = cursor.rowcount

        for idx in range(len(chunk_ids)):
            chunk_id = chunk_ids[idx]
            content = chunks[idx]
            content_complement = (
                chunk_complements[idx] if idx < complements_len else None
            )

            cursor.execute(
                sql.SQL(
                    """INSERT INTO {table} (
                        chunk_id,
                        workspace_id,
                        document_id,
                        document_sub_id,
                        document_type,
                        document_sub_type,
                        path,
                        title,
                        content,
                        content_complement,
                        content_embeddings
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,%s
                    );"""
                ).format(table=table_name),
                [
                    chunk_id,
                    workspace_id,
                    document_id,
                    document_sub_id,
                    document_type,
                    document_sub_type,
                    path,
                    title,
                    content,
                    content_complement,
                    chunk_embeddings[idx],
                ],
            )

        cursor.connection.commit()

    return {"removed_vectors": removed_vectors, "added_vectors": len(chunk_ids)}


def clean_chunks_aurora(workspace_id: str, document_id: str):
    table_name = sql.Identifier(workspace_id.replace("-", ""))
    with AuroraConnection() as cursor:
        cursor.execute(
            sql.SQL(
                """DELETE FROM {table} WHERE
                    workspace_id = %s AND document_id = %s;"""
            ).format(table=table_name),
            [workspace_id, document_id],
        )
