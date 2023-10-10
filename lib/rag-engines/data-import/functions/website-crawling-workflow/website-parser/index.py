import os
import json
import boto3
import genai_core.utils.json
import genai_core.websites.crawler
from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.typing import LambdaContext

logger = Logger()

s3_client = boto3.client("s3")
PROCESSING_BUCKET_NAME = os.environ["PROCESSING_BUCKET_NAME"]


@logger.inject_lambda_context(log_event=True)
def lambda_handler(event, context: LambdaContext):
    bucket_name = event["bucket_name"]
    object_key = event["object_key"]
    workspace_id = event["workspace_id"]
    document_id = event["document_id"]
    response = s3_client.get_object(Bucket=bucket_name, Key=object_key)
    file_content = response["Body"].read().decode("utf-8")
    data = json.loads(file_content)

    iteration = data["iteration"]
    crawler_job_id = data["crawler_job_id"]
    workspace = data["workspace"]
    document = data["document"]
    priority_queue = data["priority_queue"]
    processed_urls = data["processed_urls"]
    follow_links = data["follow_links"]
    limit = data["limit"]

    logger.info(f"Processing document {document_id} in workspace {workspace_id}")
    logger.info(f"Workspace: {workspace}")
    logger.info(f"Document: {document}")
    logger.info(f"Limit: {limit}")
    logger.info(f"Follow links: {follow_links}")
    logger.info(f"Processed urls: {priority_queue}")
    logger.info(f"Priority queue: {processed_urls}")

    result = genai_core.websites.crawler.crawl_urls(
        workspace=workspace,
        document=document,
        priority_queue=priority_queue,
        processed_urls=processed_urls,
        follow_links=follow_links,
        limit=limit,
    )

    done = result["done"]

    iteration += 1
    result["iteration"] = iteration
    result["crawler_job_id"] = crawler_job_id

    iteration_object_key = (
        f"{workspace_id}/{document_id}/crawler/{crawler_job_id}/{iteration}.json"
    )
    s3_client.put_object(
        Bucket=PROCESSING_BUCKET_NAME,
        Key=iteration_object_key,
        ContentType="application/json",
        Body=json.dumps(result, cls=genai_core.utils.json.CustomEncoder),
    )

    return {
        "done": done,
        "bucket_name": bucket_name,
        "object_key": iteration_object_key,
        "workspace_id": workspace_id,
        "document_id": document_id,
    }
