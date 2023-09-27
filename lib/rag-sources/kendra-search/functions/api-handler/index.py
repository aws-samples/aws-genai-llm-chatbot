import os

from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler import APIGatewayRestResolver
from aws_lambda_powertools.logging import correlation_paths
from aws_lambda_powertools.utilities.typing import LambdaContext
from langchain.retrievers import AmazonKendraRetriever

tracer = Tracer()
logger = Logger()
app = APIGatewayRestResolver()


@app.post("/")
@tracer.capture_method
def get_relevant_documents():
    query: dict = app.current_event.json_body.get("query")
    logger.info(query)

    retriever = AmazonKendraRetriever(
        index_id=os.environ["KENDRA_INDEX_ID"], 
        top_k=3, 
        attribute_filter={
            "EqualsTo": {      
                "Key": "_language_code",
                "Value": {
                    "StringValue": os.environ["KENDRA_LANGUAGE_CODE"]
                }
            }
        }
    )
    docs = retriever.get_relevant_documents(query)
    logger.info(docs)

    response = {
        "response": [
            {
                "page_content": doc.page_content,
                "metadata": doc.metadata,
            }
            for doc in docs
        ],
    }

    return response


@logger.inject_lambda_context(
    log_event=True, correlation_id_path=correlation_paths.API_GATEWAY_REST
)
@tracer.capture_lambda_handler
def handler(event: dict, context: LambdaContext) -> dict:
    return app.resolve(event, context)
