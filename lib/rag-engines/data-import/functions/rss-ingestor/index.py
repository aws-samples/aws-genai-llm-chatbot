from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.typing import LambdaContext
import genai_core.documents

logger = Logger()
tracer = Tracer()


@tracer.capture_lambda_handler()
@logger.inject_lambda_context(log_event=True)
def lambda_handler(event, context: LambdaContext):
    logger.info("Starting scheduled RSS Feed poll")
    workspace_id = event["workspace_id"]
    document_id = event["document_id"]
    logger.info(f"workspace_id = {workspace_id}")
    logger.info(f"document_id = {document_id}")
    try:
        genai_core.documents.check_rss_feed_for_posts(workspace_id, document_id)
    except Exception as e:
        logger.error("Error checking for new posts from feed!")
        logger.error(e)
        raise e
