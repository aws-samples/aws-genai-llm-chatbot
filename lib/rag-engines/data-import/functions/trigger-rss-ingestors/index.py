from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.typing import LambdaContext
import genai_core.documents

logger = Logger()
tracer = Tracer()


@tracer.capture_lambda_handler()
@logger.inject_lambda_context(log_event=True)
def lambda_handler(event, context: LambdaContext):
    logger.info("Triggering daily checks for RSS Feed Posts")
    try:
        genai_core.documents.ingest_rss_feeds()
    except Exception as e:
        logger.error("Error triggering RSS Feed checks")
        logger.error(e)
        raise e
