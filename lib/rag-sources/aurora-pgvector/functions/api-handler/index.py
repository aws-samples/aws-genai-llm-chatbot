import boto3
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler import APIGatewayRestResolver
from aws_lambda_powertools.logging import correlation_paths
from aws_lambda_powertools.utilities.typing import LambdaContext

from api_actions import get_embeddings, rank_sentences, semantic_search, store_documents


tracer = Tracer()
logger = Logger()

app = APIGatewayRestResolver()


@app.post("/")
@tracer.capture_method
def get_relevant_documents():
    query: dict = app.current_event.json_body.get("query")
    logger.info(query)
    docs = semantic_search(
        {
            "query": query,
        }
    )
    logger.info(docs)

    response = {
        "response": [
            {"page_content": doc.get("content", ""), "metadata": doc} for doc in docs
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
