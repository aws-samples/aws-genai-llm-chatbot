import os
import json
import boto3
import genai_core.utils.json
import genai_core.websites.crawler

PROCESSING_BUCKET_NAME = os.environ["INPUT_BUCKET_NAME"]
WORKSPACE_ID = os.environ["WORKSPACE_ID"]
DOCUMENT_ID = os.environ["DOCUMENT_ID"]
OBJECT_KEY = os.environ["INPUT_OBJECT_KEY"]
s3_client = boto3.client("s3")


def main():
    response = s3_client.get_object(Bucket=PROCESSING_BUCKET_NAME, Key=OBJECT_KEY)
    file_content = response["Body"].read().decode("utf-8")
    data = json.loads(file_content)
    print(data)

    workspace = data["workspace"]
    document = data["document"]
    priority_queue = data["priority_queue"]
    processed_urls = data["processed_urls"]
    follow_links = data["follow_links"]
    limit = data["limit"]
    content_types = data["content_types"]

    return genai_core.websites.crawler.crawl_urls(
        workspace=workspace,
        document=document,
        priority_queue=priority_queue,
        processed_urls=processed_urls,
        follow_links=follow_links,
        limit=limit,
        content_types=content_types,
    )


if __name__ == "__main__":
    main()
