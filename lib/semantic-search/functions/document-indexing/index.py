import os
import json
import boto3
import psycopg2
import urllib.parse
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.data_classes import event_source, S3Event, SQSEvent
from aws_lambda_powertools.utilities.typing import LambdaContext
from pgvector.psycopg2 import register_vector
from langchain.document_loaders import S3FileLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.embeddings import SagemakerEndpointEmbeddings
from content_handler import ContentHandler

logger = Logger(service="SemanticSearchIndexing")
tracer = Tracer(service="SemanticSearchIndexing")

REGION_NAME = os.environ["REGION_NAME"]
EMBEDDINGS_ENDPOINT_NAME = os.environ["EMBEDDINGS_ENDPOINT_NAME"]
DB_SECRET_ID = os.environ["DB_SECRET_ID"]
secretsmanager_client = boto3.client("secretsmanager")
s3_client = boto3.client("s3")

logger.debug(f"Getting database secrets from {DB_SECRET_ID}")
secret_response = secretsmanager_client.get_secret_value(SecretId=DB_SECRET_ID)
database_secrets = json.loads(secret_response["SecretString"])
dbhost = database_secrets["host"]
dbport = database_secrets["port"]
dbuser = database_secrets["username"]
dbpass = database_secrets["password"]


content_handler = ContentHandler()
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000, chunk_overlap=200, length_function=len
)

embeddingsEndpoint = SagemakerEndpointEmbeddings(
    endpoint_name=EMBEDDINGS_ENDPOINT_NAME,
    region_name=REGION_NAME,
    content_handler=content_handler,
)


@tracer.capture_lambda_handler
@logger.inject_lambda_context(log_event=True)
@event_source(data_class=SQSEvent)
def lambda_handler(event: SQSEvent, context: LambdaContext):
    logger.debug(f"Document indexing with event: {event}")
    index_documents = []

    logger.debug(f"dbhost: {dbhost}")
    logger.debug(f"dbport: {dbport}")

    for sqs_record in event.records:
        documents = get_documents_from_sqs_record(sqs_record)

        for document in documents:
            index_documents.append(index_document(document))

    return index_documents


def get_documents_from_sqs_record(record):
    logger.debug(f"Getting documents from SQS record: {record}")
    body = json.loads(record.body)
    logger.debug(f"body: {body}")

    records = body.get("Records", [])
    logger.debug(f"records: {records}")

    documents = []

    for record in records:
        event_name = record["eventName"]
        if not event_name.startswith("ObjectCreated"):
            logger.info(f"Skipping event {event_name} for {record}")
            continue

        documents.append(record)

    logger.debug(f"documents: {documents}")
    return documents


def index_document(record):
    bucket_name = record["s3"]["bucket"]["name"]
    object_key = urllib.parse.unquote_plus(record["s3"]["object"]["key"])

    logger.debug(f"bucket_name: {bucket_name}")
    logger.debug(f"object_key: {object_key}")

    logger.info(f"Loading document from s3://{bucket_name}/{object_key}")
    loader = S3FileLoader(bucket_name, object_key)
    logger.debug(f"loader: {loader}")

    logger.info(f"Splitting document from s3://{bucket_name}/{object_key}")
    texts = text_splitter.split_documents(loader.load())
    logger.debug(f"texts: {texts}")

    text_data = [text.page_content for text in texts]
    logger.debug(f"text_data: {text_data}")

    chunk_size = 500
    text_data_split = [text_data[i:i+chunk_size]
                       for i in range(0, len(text_data), chunk_size)]

    query_result = []
    for chunk in text_data_split:
        query_result_current = _get_embeddings(chunk)
        query_result.extend(query_result_current)

    data = list(zip(text_data, query_result))
    logger.debug(f"data: {data}")

    dbconn = _connect_and_register_vector()
    cur = dbconn.cursor()

    logger.info(f"Deleting existing index for {object_key}")

    cur.execute("DELETE FROM documents WHERE url = %s", [
                f"s3://{bucket_name}/{object_key}"])

    for item in data:
        logger.info(f"Indexing document for {object_key}")
        logger.debug(f"item: {item}")
        try:
            cur.execute("INSERT INTO documents (url, content, content_embeddings) VALUES (%s, %s, %s);", [
                        f"s3://{bucket_name}/{object_key}", item[0], item[1]])
        except Exception as e:
            logger.error(f"Error indexing document for {object_key}: {e}")
            _close_connections(dbconn, cur, commit=False)

            raise Exception(f"Error indexing document for {object_key}: {e}")

    # commit changes at document level and close connections
    _close_connections(dbconn, cur)
    logger.info(f"Indexed {len(query_result)} documents for {object_key}")

    response = {
        "bucket": bucket_name,
        "key": object_key,
        "indexed": len(query_result),
    }

    logger.debug(f"response: {response}")
    return response


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


def _connect_and_register_vector():
    dbconn = _connect_db()
    _register_vector(dbconn)

    return dbconn


def _close_connections(dbconn, cur, commit=True):
    if commit:
        logger.debug("Committing changes")
        dbconn.commit()

    logger.debug("Closing cursor")
    cur.close()

    logger.debug("Closing db connection")
    dbconn.close()


def _get_embeddings(inputs):
    logger.debug(f"Running get embeddings with inputs: {inputs}")

    logger.debug("Getting embeddings")
    query_result = embeddingsEndpoint.embed_documents(inputs)
    logger.debug(f"embeddings: {query_result}")

    return query_result
