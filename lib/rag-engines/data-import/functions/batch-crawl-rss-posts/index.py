from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.typing import LambdaContext
import genai_core.documents

logger = Logger()
tracer = Tracer()


@tracer.capture_lambda_handler()
@logger.inject_lambda_context(log_event=True)
def lambda_handler(event, context: LambdaContext):
    logger.debug("Starting scheduled RSS post ingestion")
    genai_core.documents.batch_crawl_websites()
