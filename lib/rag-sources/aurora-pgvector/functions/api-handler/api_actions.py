import json
import os

import boto3
import numpy as np
import psycopg2
from aws_lambda_powertools import Logger
from content_handler import ContentHandler
from cross_encoder import query_cross_encoder_model
from langchain.embeddings import SagemakerEndpointEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter
from pgvector.psycopg2 import register_vector
from psycopg2 import extras

REGION_NAME = os.environ["REGION_NAME"]
EMBEDDINGS_ENDPOINT_NAME = os.environ["EMBEDDINGS_ENDPOINT_NAME"]
CROSS_ENCODER_ENDPOINT_NAME = os.environ["CROSS_ENCODER_ENDPOINT_NAME"]
DB_SECRET_ID = os.environ["DB_SECRET_ID"]
VALID_OPERATORS = ["cosine", "l2", "inner"]
MAX_LIMIT = 100
MIN_LIMIT = 1
MIN_SCORE = 0

sagemaker_client = boto3.client("runtime.sagemaker", region_name=REGION_NAME)
secretsmanager_client = boto3.client("secretsmanager")

logger = Logger(service="SemanticSearchApi")

content_handler = ContentHandler()
embeddings = SagemakerEndpointEmbeddings(
    endpoint_name=EMBEDDINGS_ENDPOINT_NAME,
    region_name=REGION_NAME,
    content_handler=content_handler,
)

secret_response = secretsmanager_client.get_secret_value(SecretId=DB_SECRET_ID)
database_secrets = json.loads(secret_response["SecretString"])
dbhost = database_secrets["host"]
dbport = database_secrets["port"]
dbuser = database_secrets["username"]
dbpass = database_secrets["password"]


def semantic_search(event):
    logger.debug(f"Running semantic search with event: {event}")

    query = event.get("query", "")
    limit = event.get("limit", 5)
    operator = event.get("operator", "cosine")
    rerank = event.get("rerank", True)

    logger.debug(f"query: {query}")
    logger.debug(f"limit: {limit}")
    logger.debug(f"operator: {operator}")
    logger.debug(f"rerank: {rerank}")

    _validate_operator(operator)
    query = query.strip()[:1000]
    logger.debug(f"actual query: {query}")

    if not query:
        logger.debug("Empty query")
        return []

    limit = _get_limit(limit)
    logger.debug(f"actual limt: {limit}")

    query_result = _get_embeddings(query)[0]
    logger.debug(f"embeddings for {query}: {query_result}")
    logger.debug(f"embeddings for {np.array(query_result)}")

    dbconn = _connect_and_register_vector(autocommit=True)
    cur = dbconn.cursor(cursor_factory=extras.DictCursor)

    """
    https://github.com/pgvector/pgvector
    Note: <#> returns the negative inner product since Postgres only supports ASC order index scans on operators
    """
    try:
        select_limit = limit if limit > 5 else 5
        logger.debug(f"Querying database for nearest neighbors by '{operator}'")

        if operator == "cosine":  # cosine distance
            cur.execute(
                "SELECT id, url, content, content_embeddings <=> %s AS metric FROM documents ORDER BY metric LIMIT %s;",
                [np.array(query_result), select_limit],
            )
        elif operator == "l2":  # Euclidean distance
            cur.execute(
                "SELECT id, url, content, content_embeddings <-> %s AS metric FROM documents ORDER BY metric LIMIT %s;",
                [np.array(query_result), select_limit],
            )
        elif operator == "inner":  # negative inner product
            cur.execute(
                "SELECT id, url, content, content_embeddings <#> %s AS metric FROM documents ORDER BY metric LIMIT %s;",
                [np.array(query_result), select_limit],
            )

        semantic_records = cur.fetchall()
        logger.debug(f"semantic search records: {semantic_records}")

        logger.debug("Querying database by keyword match")
        cur.execute(
            "SELECT id, url, content, content FROM documents, plainto_tsquery('english', %s) query WHERE to_tsvector('english', content) @@ query ORDER BY ts_rank_cd(to_tsvector('english', content), query) DESC LIMIT %s;",
            [query, select_limit],
        )
        keyword_records = cur.fetchall()
        logger.debug(f"keyword search records: {keyword_records}")
    except Exception as e:
        logger.error(f"Error querying database: {e}")
        raise e
    finally:
        logger.debug("Closing database connection")
        cur.close()
        dbconn.close()
        logger.debug("Closed database connection")

    converted_semantic_records = [
        {
            "id": record[0],
            "url": record[1],
            "content": record[2],
            "metric": record[3],
        }
        for record in semantic_records
    ]

    converted_keyword_records = [
        {
            "id": record[0],
            "url": record[1],
            "content": record[2],
        }
        for record in keyword_records
    ]

    if not rerank:
        logger.debug("Not reranking required, returning results")
        return {
            "semantic_search": converted_semantic_records,
            "keyword_search": converted_keyword_records,
        }

    logger.debug(
        "Reranking results with cross encoder model {CROSS_ENCODER_ENDPOINT_NAME}}"
    )

    records = converted_semantic_records + converted_keyword_records
    unique_identifiers = set()
    unique_records = []
    for record in records:
        identifier = record["id"]
        if identifier not in unique_identifiers:
            unique_identifiers.add(identifier)
            unique_records.append(record)

    sentences = [record["content"] for record in unique_records]
    logger.debug(f"sentences: {sentences}")

    if not sentences:
        return []

    scores = _rank_sentences(query, sentences)
    records = list(zip(records, scores))
    logger.debug(f"Reranking records: {records}")
    records = sorted(records, key=lambda x: x[1], reverse=True)
    logger.debug(f"Reranking sorted records: {records}")

    logger.debug(f"Filtering out results with score < {MIN_SCORE}")
    ranked_records = [
        {
            "id": record[0]["id"],
            "url": record[0]["url"],
            "content": record[0]["content"],
            "score": record[1],
        }
        for record in records
        if record[1] > MIN_SCORE
    ]

    logger.debug(f"Returning reranked records: {ranked_records}")
    return ranked_records[:limit]


def get_embeddings(event):
    logger.debug(f"Running get embeddings with event: {event}")
    inputs = event.get("inputs", [])
    logger.debug(f"inputs: {inputs}")

    return _get_embeddings(inputs)


def rank_sentences(event):
    logger.debug(f"Running rank sentences with event: {event}")
    query = event.get("query", "")
    sentences = event.get("sentences", [])

    return _rank_sentences(query, sentences)


def store_documents(event):
    logger.debug(f"Running store documents with event: {event}")

    documents = event.get("documents", [])
    chunk_size = event.get("chunk_size", 1000)
    chunk_overlap = event.get("chunk_overlap", 200)

    logger.debug(f"documents: {documents}")
    logger.debug(f"chunk_size: {chunk_size}")
    logger.debug(f"chunk_overlap: {chunk_overlap}")

    logger.debug(
        f"Splitting documents into chunks of size {chunk_size} with overlap {chunk_overlap}"
    )
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size, chunk_overlap=chunk_overlap, length_function=len
    )
    logger.debug(f"Splitted results: {text_splitter}")

    dbconn = _connect_and_register_vector(autocommit=False)

    logger.debug(f"Indexing {len(documents)} documents")

    indexed_documents = 0
    indexed = 0

    for document in documents:
        logger.debug(f"Indexing document: {document}")

        document_url = document.get("url", "")
        document_content = document.get("content", "")
        logger.debug(f"document_url: {document_url}")
        logger.debug(f"document_content: {document_content}")

        if not document_content or not document_url:
            error = "Invalid document. Missing content or url"
            logger.error(error)
            raise Exception(error)

        text_data = text_splitter.split_text(document_content)
        logger.debug(f"Split text data: {text_data}")

        chunk_size = 500
        text_data_split = [
            text_data[i : i + chunk_size] for i in range(0, len(text_data), chunk_size)
        ]

        query_result = []
        for chunk in text_data_split:
            query_result_current = _get_embeddings(chunk)
            query_result.extend(query_result_current)

        data = list(zip(text_data, query_result))
        logger.debug(f"Data: {data}")

        cur = dbconn.cursor()

        logger.debug(f"Deleting existing records for url: {document_url}")
        cur.execute("DELETE FROM documents WHERE url = %s", [document_url])

        logger.debug(f"Inserting new records for url: {document_url}")
        for item in data:
            logger.debug(f"Inserting item: {item}")
            cur.execute(
                "INSERT INTO documents (url, content, content_embeddings) VALUES (%s, %s, %s);",
                [document_url, item[0], item[1]],
            )

        cur.close()
        indexed_documents += 1
        indexed += len(data)

    dbconn.commit()
    dbconn.close()

    return {"documents": indexed_documents, "indexed": indexed}


def _connect_db():
    logger.debug(f"Connecting to database {dbhost}:{dbport}")
    dbconn = psycopg2.connect(
        host=dbhost, user=dbuser, password=dbpass, port=dbport, connect_timeout=10
    )
    logger.debug(f"Connected to database {dbhost}:{dbport} => {dbconn}")

    return dbconn


def _register_vector(dbconn):
    logger.debug("Registering vector extension")
    register_vector(dbconn)
    logger.debug("Registered vector extension")


def _connect_and_register_vector(autocommit=False):
    dbconn = _connect_db()
    dbconn.set_session(autocommit=autocommit)

    _register_vector(dbconn)

    return dbconn


def _get_embeddings(inputs):
    logger.debug(f"Running get embeddings with inputs: {inputs}")

    logger.debug("Getting embeddings")
    query_result = embeddings.embed_documents(inputs)
    logger.debug(f"embeddings: {query_result}")

    return query_result


def _rank_sentences(query, sentences):
    logger.debug(f"query: {query}")
    logger.debug(f"sentences: {sentences}")

    scores = query_cross_encoder_model(
        sagemaker_client, CROSS_ENCODER_ENDPOINT_NAME, query, sentences
    )
    scores = [score[0] for score in scores]

    return scores


def _get_limit(limit):
    if limit > MAX_LIMIT:
        return MAX_LIMIT

    if limit < MIN_LIMIT:
        return MIN_LIMIT

    return limit


def _validate_operator(operator):
    if operator not in VALID_OPERATORS:
        error = f"Invalid operator: {operator}. Valid operators are: {VALID_OPERATORS}"
        logger.error(error)

        raise Exception(error)
