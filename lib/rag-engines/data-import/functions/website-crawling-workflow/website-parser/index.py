import boto3
import genai_core.websites.crawler
from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.typing import LambdaContext

logger = Logger()

s3 = boto3.resource("s3")


@logger.inject_lambda_context(log_event=True)
def lambda_handler(event, context: LambdaContext):
    workspace_id = event["workspace_id"]
    document_id = event["document_id"]
    workspace = event["workspace"]
    document = event["document"]
    limit = event["limit"]
    follow_links = event["follow_links"]
    urls_to_crawl = event["urls_to_crawl"]
    processed_urls = event["processed_urls"]

    logger.info(
        f"Processing document {document_id} in workspace {workspace_id}")
    logger.info(f"Workspace: {workspace}")
    logger.info(f"Document: {document}")
    logger.info(f"Limit: {limit}")
    logger.info(f"Follow links: {follow_links}")
    logger.info(f"Urls to crawl: {urls_to_crawl}")
    logger.info(f"Processed urls: {processed_urls}")

    genai_core.websites.crawler.crawl_urls(workspace=workspace,
                                           document=document,
                                           urls_to_crawl=urls_to_crawl,
                                           limit=limit,
                                           follow_links=follow_links)

    return {"ok": True}
