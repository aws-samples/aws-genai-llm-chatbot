from aws_lambda_powertools import Logger
from psycopg2 import sql
from genai_core.aurora.connection import AuroraConnection

logger = Logger()


def create_workspace_table(workspace: dict):
    workspace_id = workspace["workspace_id"]
    table_name = sql.Identifier(workspace_id.replace("-", ""))

    embeddings_model_dimensions = workspace["embeddings_model_dimensions"]
    hybrid_search = workspace["hybrid_search"]
    languages = workspace["languages"]
    has_index = workspace["has_index"]
    metric = workspace["metric"]

    with AuroraConnection(autocommit=False) as cursor:
        cursor.execute(
            sql.SQL(
                """CREATE TABLE {table} (
                    chunk_id UUID PRIMARY KEY,
                    workspace_id UUID,
                    document_id UUID,
                    document_sub_id UUID,
                    document_type VARCHAR(50),
                    document_sub_type VARCHAR(50),
                    path TEXT,
                    language VARCHAR(15),
                    title TEXT,
                    content TEXT,
                    content_complement TEXT,
                    content_embeddings vector(%s),
                    metadata JSONB,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );"""
            ).format(table=table_name),
            [embeddings_model_dimensions],
        )

        cursor.execute(
            sql.SQL("CREATE INDEX ON {table} (document_id);").format(table=table_name)
        )

        cursor.execute(
            sql.SQL("CREATE INDEX ON {table} (document_sub_id);").format(
                table=table_name
            )
        )

        if hybrid_search:
            for language in languages:
                cursor.execute(
                    sql.SQL(
                        "CREATE INDEX ON {table} USING "
                        + " GIN (to_tsvector('{language}', content));"
                    ).format(table=table_name, language=sql.Identifier(language))
                )

        if has_index:
            if metric == "cosine":
                cursor.execute(
                    sql.SQL(
                        "CREATE INDEX ON {table} USING ivfflat "
                        + "(content_embeddings vector_cosine_ops) WITH (lists = 100);"
                    ).format(table=table_name)
                )
            elif metric == "l2":
                cursor.execute(
                    sql.SQL(
                        "CREATE INDEX ON {table} USING ivfflat "
                        + "(content_embeddings vector_l2_ops) WITH (lists = 100);"
                    ).format(table=table_name)
                )
            elif metric == "inner":
                cursor.execute(
                    sql.SQL(
                        "CREATE INDEX ON {table} USING ivfflat "
                        + "(content_embeddings vector_ip_ops) WITH (lists = 100);"
                    ).format(table=table_name)
                )

        cursor.connection.commit()
        logger.info("Created workspace table")
