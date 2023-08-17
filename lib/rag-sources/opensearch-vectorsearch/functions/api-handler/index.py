import os

import boto3
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler import APIGatewayRestResolver
from aws_lambda_powertools.logging import correlation_paths
from aws_lambda_powertools.utilities.typing import LambdaContext
from langchain.embeddings import BedrockEmbeddings
from langchain.vectorstores import OpenSearchVectorSearch
from opensearchpy import RequestsHttpConnection
from requests_aws4auth import AWS4Auth

tracer = Tracer()
logger = Logger()

app = APIGatewayRestResolver()


@app.post("/")
@tracer.capture_method
def get_relevant_documents():
    query: dict = app.current_event.json_body.get("query")
    logger.info(query)
    index_name = os.environ["AOSS_INDEX_NAME"]
    endpoint = os.environ["AOSS_COLLECTION_ENDPOINT"]

    embeddings = BedrockEmbeddings(
        client=get_bedrock_client(),
    )

    vector_store = OpenSearchVectorSearch(
        index_name=index_name,
        embedding_function=embeddings,
        opensearch_url=endpoint,
        http_auth=get_aws4_auth(),
        use_ssl=True,
        verify_certs=True,
        connection_class=RequestsHttpConnection,
    )
    retriever = vector_store.as_retriever()
    logger.info(retriever)
    docs = retriever.get_relevant_documents(query)
    logger.info(docs)

    response = {
        "response": [
            {
                "page_content": doc.page_content,
                # remove vector field from metadata as it is too large to return
                "metadata": {
                    k: v for k, v in doc.metadata.items() if k != "vector_field"
                },
            }
            for doc in docs
        ],
    }
    logger.info(response)

    return response


@logger.inject_lambda_context(
    log_event=True, correlation_id_path=correlation_paths.API_GATEWAY_REST
)
@tracer.capture_lambda_handler
def handler(event: dict, context: LambdaContext) -> dict:
    return app.resolve(event, context)


def get_bedrock_client():
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
