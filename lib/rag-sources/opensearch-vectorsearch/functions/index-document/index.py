import json
import os
import urllib.parse

import boto3

from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.batch import BatchProcessor, EventType
from aws_lambda_powertools.utilities.data_classes.sqs_event import SQSRecord
from aws_lambda_powertools.utilities.batch import (
    BatchProcessor,
    EventType,
    process_partial_response,
)
from aws_lambda_powertools.utilities.typing import LambdaContext
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.document_loaders import S3FileLoader


from opensearchpy import OpenSearch, RequestsHttpConnection
from requests_aws4auth import AWS4Auth

from langchain.embeddings import BedrockEmbeddings

processor = BatchProcessor(event_type=EventType.SQS)
tracer = Tracer()
logger = Logger()

endpoint = os.environ["AOSS_COLLECTION_ENDPOINT"]
port = os.environ.get("AOSS_COLLECTION_ENDPOINT_PORT", 443)
region = os.environ["AWS_REGION"]
service = "aoss"
credentials = boto3.Session().get_credentials()
awsauth = AWS4Auth(
    credentials.access_key,
    credentials.secret_key,
    region,
    service,
    session_token=credentials.token,
)
opensearch = OpenSearch(
    hosts=[{"host": urllib.parse.urlparse(endpoint).hostname, "port": int(port)}],
    http_auth=awsauth,
    use_ssl=True,
    verify_certs=True,
    connection_class=RequestsHttpConnection,
    timeout=300,
)


text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000, chunk_overlap=200, length_function=len
)


@tracer.capture_method
def record_handler(record: SQSRecord):
    body: str = record.body
    payload: dict = json.loads(body)
    logger.info(payload)
    documents_to_add, documents_to_remove = get_documents_from_sqs_record(payload)
    index_documents = []

    for document in documents_to_add:
        index_documents.append(add_document_to_index(document))

    for document in documents_to_remove:
        index_documents.append(remove_document_from_index(document))

    return index_documents


def get_documents_from_sqs_record(message):
    logger.debug(f"Getting documents from SQS record: {message}")
    documents_to_add = []
    documents_to_remove = []

    for record in message["Records"]:
        event_name = record["eventName"]
        if event_name.startswith("ObjectCreated"):
            documents_to_add.append(record)

        if event_name.startswith("ObjectRemoved"):
            documents_to_remove.append(record)

    logger.debug(f"documents_to_add: {documents_to_add}")
    logger.debug(f"documents_to_remove: {documents_to_remove}")
    return documents_to_add, documents_to_remove


@tracer.capture_method
def add_document_to_index(document):
    bucket_name = document["s3"]["bucket"]["name"]
    object_key = urllib.parse.unquote_plus(document["s3"]["object"]["key"])
    url = f"s3://{bucket_name}/{object_key}"

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
    logger.info(text_data)

    chunk_size = 500
    text_data_split = [
        text_data[i : i + chunk_size] for i in range(0, len(text_data), chunk_size)
    ]

    query_result = []
    for chunk in text_data_split:
        query_result_current = _get_embeddings(chunk)
        query_result.extend(query_result_current)

    data = list(zip(text_data, query_result))
    logger.debug(f"data: {data}")

    for item in data:
        logger.info(f"Indexing document for {object_key}")
        logger.debug(f"item: {item}")

        response = opensearch.index(
            index=os.environ["AOSS_INDEX_NAME"],
            body={"vector_field": item[1], "text": item[0], "url": url},
        )
        print(f"Document {url} added:")
        print(response)

    response = {
        "bucket": bucket_name,
        "key": object_key,
        "indexed": len(query_result),
    }

    logger.debug(f"response: {response}")
    return response


@tracer.capture_method
def remove_document_from_index(document):
    bucket_name = document["s3"]["bucket"]["name"]
    object_key = urllib.parse.unquote_plus(document["s3"]["object"]["key"])

    logger.debug(f"bucket_name: {bucket_name}")
    logger.debug(f"object_key: {object_key}")

    url = f"s3://{bucket_name}/{object_key}"

    response = opensearch.search(
        index=os.environ["AOSS_INDEX_NAME"], body={"query": {"match": {"url": url}}}
    )
    logger.info(f"Found {response['hits']['total']['value']} documents to delete")

    for hit in response["hits"]["hits"]:
        logger.info(f"Deleting document {hit['_id']}")
        opensearch.delete(index=os.environ["AOSS_INDEX_NAME"], id=hit["_id"])

    response = {
        "bucket": bucket_name,
        "key": object_key,
        "removed": response["hits"]["total"]["value"],
    }

    logger.debug(f"response: {response}")
    return response


@logger.inject_lambda_context(log_event=True)
@tracer.capture_lambda_handler
def lambda_handler(event, context: LambdaContext):
    return process_partial_response(
        event=event, record_handler=record_handler, processor=processor, context=context
    )


def _get_embeddings(inputs):
    logger.debug(f"Running get embeddings with inputs: {inputs}")

    embeddings = BedrockEmbeddings(
        client=get_bedrock_client(),
    )

    logger.debug("Getting embeddings")
    query_result = embeddings.embed_documents(inputs)
    logger.debug(f"embeddings: {query_result}")

    return query_result


def get_bedrock_client():
    """Until Bedrock goes GA, we need to assume a role to use it."""
    region_name = os.environ["BEDROCK_REGION"]
    endpoint_url = os.environ["BEDROCK_ENDPOINT_URL"]
    return boto3.client(
        "bedrock",
        region_name=region_name,
        endpoint_url=endpoint_url,
    )


def get_aws4_auth():
    region = os.environ.get("Region", os.environ["AWS_REGION"])
    service = "aoss"
    credentials = boto3.Session().get_credentials()
    return AWS4Auth(
        credentials.access_key,
        credentials.secret_key,
        region,
        service,
        session_token=credentials.token,
    )
