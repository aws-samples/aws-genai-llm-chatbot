import os
import json
import uuid
from aws_lambda_powertools import Logger
import boto3
import botocore
import feedparser
import genai_core.types
import genai_core.chunks
import genai_core.websites
import genai_core.utils.json
import genai_core.workspaces
import genai_core.utils.files
from typing import Optional
from datetime import datetime
import hashlib

PROCESSING_BUCKET_NAME = os.environ.get("PROCESSING_BUCKET_NAME", "")
WORKSPACES_TABLE_NAME = os.environ.get("WORKSPACES_TABLE_NAME", "")
DOCUMENTS_TABLE_NAME = os.environ.get("DOCUMENTS_TABLE_NAME")
DOCUMENTS_BY_COMPOUND_KEY_INDEX_NAME = os.environ.get(
    "DOCUMENTS_BY_COMPOUND_KEY_INDEX_NAME"
)
FILE_IMPORT_WORKFLOW_ARN = os.environ.get("FILE_IMPORT_WORKFLOW_ARN")
WEBSITE_CRAWLING_WORKFLOW_ARN = os.environ.get("WEBSITE_CRAWLING_WORKFLOW_ARN")
DEFAULT_KENDRA_S3_DATA_SOURCE_BUCKET_NAME = os.environ.get(
    "DEFAULT_KENDRA_S3_DATA_SOURCE_BUCKET_NAME"
)

DELETE_DOCUMENT_WORKFLOW_ARN = os.environ.get("DELETE_DOCUMENT_WORKFLOW_ARN")
RSS_FEED_INGESTOR_FUNCTION = os.environ.get("RSS_FEED_INGESTOR_FUNCTION", "")
RSS_FEED_SCHEDULE_ROLE_ARN = os.environ.get("RSS_FEED_SCHEDULE_ROLE_ARN", "")
DOCUMENTS_BY_STATUS_INDEX = os.environ.get("DOCUMENTS_BY_STATUS_INDEX", "")

WORKSPACE_OBJECT_TYPE = "workspace"

s3 = boto3.resource("s3")
s3_client = boto3.client("s3")
dynamodb = boto3.resource("dynamodb")
dynamodb_client = boto3.client("dynamodb")
sfn_client = boto3.client("stepfunctions")
scheduler = boto3.client("scheduler")
lambda_client = boto3.client("lambda")

documents_table = dynamodb.Table(DOCUMENTS_TABLE_NAME)
workspaces_table = dynamodb.Table(WORKSPACES_TABLE_NAME)
logger = Logger()


def list_documents(
    workspace_id: str,
    document_type: str,
    last_document_id: str = None,
    page_size: int = 100,
    parent_document_id: str = None,
):
    workspace = genai_core.workspaces.get_workspace(workspace_id)
    if not workspace:
        raise genai_core.types.CommonError("Workspace not found")

    scan_index_forward = True
    if document_type == "text" or document_type == "qna":
        scan_index_forward = False

    sort_key_prefix = f"{document_type}/"
    if parent_document_id != None:
        sort_key_prefix = sort_key_prefix + f"{parent_document_id}/"

    if last_document_id:
        last_document = get_document(workspace_id, last_document_id)
        if not last_document:
            raise genai_core.types.CommonError("Last document not found")
        last_document_compound_sort_key = last_document["compound_sort_key"]

        response = documents_table.query(
            IndexName=DOCUMENTS_BY_COMPOUND_KEY_INDEX_NAME,
            KeyConditionExpression="workspace_id = :workspace_id AND "
            + "begins_with(compound_sort_key, :sort_key_prefix)",
            ExclusiveStartKey={
                "workspace_id": workspace_id,
                "document_id": last_document_id,
                "compound_sort_key": last_document_compound_sort_key,
            },
            ExpressionAttributeValues={
                ":workspace_id": workspace_id,
                ":sort_key_prefix": sort_key_prefix,
            },
            Limit=page_size,
            ScanIndexForward=scan_index_forward,
        )
    else:
        response = documents_table.query(
            IndexName=DOCUMENTS_BY_COMPOUND_KEY_INDEX_NAME,
            KeyConditionExpression="workspace_id = :workspace_id AND "
            + "begins_with(compound_sort_key, :sort_key_prefix)",
            ExpressionAttributeValues={
                ":workspace_id": workspace_id,
                ":sort_key_prefix": sort_key_prefix,
            },
            Limit=page_size,
            ScanIndexForward=scan_index_forward,
        )

    items = response["Items"]
    last_evaluated_key = response.get("LastEvaluatedKey", {})
    last_document_id = last_evaluated_key.get("document_id", None)

    return {
        "items": items,
        "last_document_id": last_document_id,
    }


def set_document_vectors(
    workspace_id: str, document_id: str, vectors: int, replace: bool
):
    timestamp = _get_timestamp()

    response = workspaces_table.update_item(
        Key={"workspace_id": workspace_id, "object_type": WORKSPACE_OBJECT_TYPE},
        UpdateExpression="ADD vectors :incrementValue SET updated_at=:timestampValue",
        ExpressionAttributeValues={
            ":incrementValue": vectors,
            ":timestampValue": timestamp,
        },
    )

    if replace:
        response = documents_table.update_item(
            Key={"workspace_id": workspace_id, "document_id": document_id},
            UpdateExpression="SET vectors=:vectorsValue, "
            + "updated_at=:timestampValue",
            ExpressionAttributeValues={
                ":vectorsValue": vectors,
                ":timestampValue": timestamp,
            },
        )
    else:
        response = documents_table.update_item(
            Key={"workspace_id": workspace_id, "document_id": document_id},
            UpdateExpression="ADD vectors :incrementValue SET "
            + "updated_at=:timestampValue",
            ExpressionAttributeValues={
                ":incrementValue": vectors,
                ":timestampValue": timestamp,
            },
        )

    logger.info("Response for set_document_vectors", response=response)

    return response


def set_sub_documents(workspace_id: str, document_id: str, sub_documents: int):
    timestamp = _get_timestamp()

    response = documents_table.update_item(
        Key={"workspace_id": workspace_id, "document_id": document_id},
        UpdateExpression="SET sub_documents=:subDocumentsValue, "
        + "updated_at=:timestampValue",
        ExpressionAttributeValues={
            ":subDocumentsValue": sub_documents,
            ":timestampValue": timestamp,
        },
    )

    logger.info("Response for set_sub_documents", response=response)

    return response


def get_document(workspace_id: str, document_id: str):
    response = documents_table.get_item(
        Key={"workspace_id": workspace_id, "document_id": document_id}
    )
    document = response.get("Item")

    return document


def delete_document(workspace_id: str, document_id: str):
    response = documents_table.get_item(
        Key={"workspace_id": workspace_id, "document_id": document_id}
    )

    document = response.get("Item")

    if not document:
        raise genai_core.types.CommonError("Document not found")

    if (
        document["status"] != "processed"
        and document["status"] != "error"
        and document["status"] != "enabled"  # rss feed final status
    ):
        raise genai_core.types.CommonError("Document not ready for deletion")

    response = sfn_client.start_execution(
        stateMachineArn=DELETE_DOCUMENT_WORKFLOW_ARN,
        input=json.dumps(
            {
                "workspace_id": workspace_id,
                "document_id": document_id,
            }
        ),
    )

    logger.info("Response for delete_document", response=response)
    return {"documentId": document_id, "deleted": True}


def get_document_content(workspace_id: str, document_id: str):
    content_key = f"{workspace_id}/{document_id}/content.txt"
    content_complement_key = f"{workspace_id}/{document_id}/content_complement.txt"
    if not genai_core.utils.files.file_exists(PROCESSING_BUCKET_NAME, content_key):
        return None

    response = s3.Object(PROCESSING_BUCKET_NAME, content_key).get()
    content = response["Body"].read().decode("utf-8")

    content_complement = None
    if genai_core.utils.files.file_exists(
        PROCESSING_BUCKET_NAME, content_complement_key
    ):
        response = s3.Object(PROCESSING_BUCKET_NAME, content_complement_key).get()
        content_complement = response["Body"].read().decode("utf-8")

    return {"content": content, "content_complement": content_complement}


def set_status(workspace_id: str, document_id: str, status: str):
    timestamp = _get_timestamp()
    response = documents_table.update_item(
        Key={"workspace_id": workspace_id, "document_id": document_id},
        UpdateExpression="SET #status=:status, updated_at=:timestampValue",
        ExpressionAttributeNames={
            "#status": "status",
        },
        ExpressionAttributeValues={
            ":status": status,
            ":timestampValue": timestamp,
        },
    )
    return response


def update_subscription_timestamp(workspace_id: str, document_id: str):
    timestamp = _get_timestamp()
    response = documents_table.update_item(
        Key={"workspace_id": workspace_id, "document_id": document_id},
        UpdateExpression="SET rss_last_checked=:timestampValue",
        ExpressionAttributeValues={
            ":timestampValue": timestamp,
        },
    )
    logger.info("Response for update_subscription_timestamp", response=response)


def create_document(
    workspace_id: str,
    document_type: str,
    document_sub_type: Optional[str] = None,
    title: Optional[str] = None,
    path: Optional[str] = None,
    size_in_bytes: int = 0,
    sub_documents: int = 0,
    content: Optional[str] = None,
    content_complement: Optional[str] = None,
    **kwargs,
):
    timestamp = _get_timestamp()
    workspace = genai_core.workspaces.get_workspace(workspace_id)
    if not workspace:
        raise genai_core.types.CommonError("Workspace not found")

    document = None
    unique_path_document = document_type in ["file", "website", "rssfeed"]
    if unique_path_document:
        response = documents_table.query(
            IndexName=DOCUMENTS_BY_COMPOUND_KEY_INDEX_NAME,
            KeyConditionExpression="workspace_id=:workspaceValue AND "
            + "compound_sort_key=:compoundKeyValue",
            ExpressionAttributeValues={
                ":workspaceValue": workspace_id,
                ":compoundKeyValue": f"{document_type}/{path}",
            },
        )

        items = response["Items"]
        document = items[0] if len(items) > 0 else None

    current_size_in_bytes = 0
    current_vectors = 0
    documents_diff = 0

    if unique_path_document and document:
        document_id = document["document_id"]
        current_size_in_bytes = document["size_in_bytes"]
        current_vectors = document["vectors"]

        response = documents_table.update_item(
            Key={
                "workspace_id": workspace_id,
                "document_id": document_id,
            },
            UpdateExpression="SET compound_sort_key=:compoundKeyValue, "
            + "#status=:statusValue, size_in_bytes=:sizeValue, "
            + "vectors=:vectorsValue, updated_at=:timestampValue",
            ExpressionAttributeNames={"#status": "status"},
            ExpressionAttributeValues={
                ":compoundKeyValue": f"{document_type}/{path}",
                ":statusValue": "submitted",
                ":sizeValue": size_in_bytes,
                ":vectorsValue": 0,
                ":timestampValue": timestamp,
            },
            ReturnValues="ALL_NEW",
        )

        document = response["Attributes"]
    else:
        documents_diff = 1
        document_id = str(uuid.uuid4())

        compound_sort_key = f"{document_type}/{timestamp}"
        if document_type in ["file", "website", "rssfeed"]:
            compound_sort_key = f"{document_type}/{path}"

        document = {
            "format_version": 1,
            "workspace_id": workspace_id,
            "document_id": document_id,
            "document_type": document_type,
            "document_sub_type": document_sub_type,
            "sub_documents": sub_documents,
            "compound_sort_key": compound_sort_key,
            "status": "submitted",
            "title": title,
            "path": path,
            "size_in_bytes": size_in_bytes,
            "vectors": 0,
            "errors": [],
            "created_at": timestamp,
            "updated_at": timestamp,
        }
        if document_type in ["rssfeed"] and "crawler_properties" in kwargs:
            document["crawler_properties"] = kwargs["crawler_properties"]

        response = documents_table.put_item(Item=document)

    size_diff = size_in_bytes - current_size_in_bytes
    response = workspaces_table.update_item(
        Key={"workspace_id": workspace_id, "object_type": WORKSPACE_OBJECT_TYPE},
        UpdateExpression="ADD size_in_bytes :incrementValue, "
        + "documents :documentsIncrementValue, "
        + "vectors :vectorsIncrementValue SET updated_at=:timestampValue",
        ExpressionAttributeValues={
            ":incrementValue": size_diff,
            ":documentsIncrementValue": documents_diff,
            ":vectorsIncrementValue": -current_vectors,
            ":timestampValue": timestamp,
        },
        ReturnValues="UPDATED_NEW",
    )

    logger.info("Response for create_document", response=response)

    _upload_document_content(
        workspace_id,
        document_id,
        document_type,
        content=content,
        content_complement=content_complement,
    )

    workspace_engine = workspace["engine"]
    if workspace_engine == "kendra":
        _process_document_kendra(
            workspace, document, content=content, content_complement=content_complement
        )
    else:
        _process_document(
            workspace,
            document,
            content=content,
            content_complement=content_complement,
            **kwargs,
        )

    return {
        "workspace_id": workspace_id,
        "document_id": document_id,
    }


def update_document(workspace_id: str, document_id: str, document_type: str, **kwargs):
    timestamp = _get_timestamp()
    workspace = genai_core.workspaces.get_workspace(workspace_id)
    if not workspace:
        raise genai_core.types.CommonError("Workspace not found")

    rss_document = get_document(workspace_id, document_id)
    if not rss_document:
        raise genai_core.types.CommonError("Document not found")

    if document_type == "rssfeed":
        if "limit" in kwargs and "follow_links" in kwargs:
            follow_links = kwargs["follow_links"]
            limit = kwargs["limit"]
            content_types = kwargs["content_types"]
            response = documents_table.update_item(
                Key={"workspace_id": workspace_id, "document_id": document_id},
                UpdateExpression="SET #crawler_properties=:crawler_properties, "
                + "updated_at=:timestampValue",
                ExpressionAttributeNames={"#crawler_properties": "crawler_properties"},
                ExpressionAttributeValues={
                    ":crawler_properties": {
                        "follow_links": follow_links,
                        "limit": limit,
                        "content_types": content_types,
                    },
                    ":timestampValue": timestamp,
                },
                ReturnValues="ALL_NEW",
            )
            return response
        else:
            raise Exception("Invalid update values for rssfeed")
    else:
        return f"Error! Document Type {document_type} doesn't have any update options"


def _get_timestamp():
    return datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%fZ")


def _process_document_kendra(
    workspace: dict,
    document: dict,
    content: Optional[str] = None,
    content_complement: Optional[str] = None,
):
    workspace_id = workspace["workspace_id"]
    document_id = document["document_id"]
    document_type = document["document_type"]

    if document_type == "text":
        processing_object_key = f"{workspace_id}/{document_id}/content.txt"
        kendra_object_key = f"documents/{processing_object_key}"
        kendra_metadata_key = (
            f"metadata/documents/{processing_object_key}.metadata.json"
        )

        metadata = {
            "DocumentId": document_id,
            "Attributes": {
                "workspace_id": workspace_id,
                "document_type": document_type,
            },
        }

        title = workspace.get("title")
        if title:
            metadata["Title"] = title

        s3_client.copy_object(
            CopySource={"Bucket": PROCESSING_BUCKET_NAME, "Key": processing_object_key},
            Bucket=DEFAULT_KENDRA_S3_DATA_SOURCE_BUCKET_NAME,
            Key=kendra_object_key,
        )

        s3_client.put_object(
            Body=json.dumps(metadata),
            Bucket=DEFAULT_KENDRA_S3_DATA_SOURCE_BUCKET_NAME,
            Key=kendra_metadata_key,
            ContentType="application/json",
        )

        set_status(workspace_id, document_id, "processed")


def _process_document(
    workspace: dict,
    document: dict,
    content: Optional[str] = None,
    content_complement: Optional[str] = None,
    **kwargs,
):
    workspace_id = workspace["workspace_id"]
    document_id = document["document_id"]
    document_type = document["document_type"]

    if document_type == "text":
        object_key = f"{workspace_id}/{document_id}/content.txt"
        response = sfn_client.start_execution(
            stateMachineArn=FILE_IMPORT_WORKFLOW_ARN,
            input=json.dumps(
                {
                    "workspace_id": workspace_id,
                    "document_id": document_id,
                    "input_bucket_name": PROCESSING_BUCKET_NAME,
                    "input_object_key": object_key,
                    "processing_bucket_name": PROCESSING_BUCKET_NAME,
                    "processing_object_key": object_key,
                }
            ),
        )

        logger.info("Response for _process_document", response=response)
    elif document_type == "qna":
        chunk_complements = None
        if content_complement is not None:
            chunk_complements = [content_complement]

        genai_core.chunks.add_chunks(
            workspace=workspace,
            document=document,
            document_sub_id=None,
            chunks=[content],
            chunk_complements=chunk_complements,
            replace=True,
        )

        set_status(workspace_id, document_id, "processed")
    elif document_type == "website":
        document_sub_type = document["document_sub_type"]
        path = document["path"]
        urls_to_crawl = [path]

        crawler_properties = kwargs["crawler_properties"]
        follow_links = crawler_properties["follow_links"]
        limit = crawler_properties["limit"]
        content_types = crawler_properties["content_types"]

        if document_sub_type == "sitemap":
            follow_links = False

            try:
                urls_to_crawl = genai_core.websites.extract_urls_from_sitemap(path)
                limit = min(limit, len(urls_to_crawl))

                if len(urls_to_crawl) == 0:
                    set_status(workspace_id, document_id, "error")
                    raise genai_core.types.CommonError("No urls found in sitemap")
            except Exception as e:
                logger.exception(e)
                set_status(workspace_id, document_id, "error")
                raise genai_core.types.CommonError("Error extracting urls from sitemap")

        iteration = 1
        crawler_job_id = str(uuid.uuid4())
        iteration_object_key = (
            f"{workspace_id}/{document_id}/crawler/{crawler_job_id}/{iteration}.json"
        )
        priority_queue = [{"url": url, "priority": 1} for url in set(urls_to_crawl)]
        s3_client.put_object(
            Body=json.dumps(
                {
                    "iteration": iteration,
                    "crawler_job_id": crawler_job_id,
                    "workspace_id": workspace_id,
                    "document_id": document_id,
                    "workspace": workspace,
                    "document": document,
                    "priority_queue": priority_queue,
                    "processed_urls": [],
                    "follow_links": follow_links,
                    "limit": limit,
                    "content_types": content_types,
                    "done": False,
                },
                cls=genai_core.utils.json.CustomEncoder,
            ),
            Bucket=PROCESSING_BUCKET_NAME,
            Key=iteration_object_key,
            ContentType="application/json",
        )

        response = sfn_client.start_execution(
            stateMachineArn=WEBSITE_CRAWLING_WORKFLOW_ARN,
            input=json.dumps(
                {
                    "workspace_id": workspace_id,
                    "document_id": document_id,
                    "bucket_name": PROCESSING_BUCKET_NAME,
                    "object_key": iteration_object_key,
                },
                cls=genai_core.utils.json.CustomEncoder,
            ),
        )

        logger.info("Response for _process_document", response=response)
    elif document_type == "rssfeed":
        set_status(workspace_id, document_id, "enabled")
        _trigger_rss_feed_ingestor(workspace_id, document_id)


def _upload_document_content(
    workspace_id: str,
    document_id: str,
    document_type: str,
    content: Optional[str] = None,
    content_complement: Optional[str] = None,
):
    if document_type == "text":
        s3.Object(
            PROCESSING_BUCKET_NAME, f"{workspace_id}/{document_id}/content.txt"
        ).put(Body=content)
    elif document_type == "qna":
        s3.Object(
            PROCESSING_BUCKET_NAME, f"{workspace_id}/{document_id}/content.txt"
        ).put(Body=content)
        s3.Object(
            PROCESSING_BUCKET_NAME,
            f"{workspace_id}/{document_id}/content_complement.txt",
        ).put(Body=content_complement)


def ingest_rss_feeds():
    feeds_to_crawl = dynamodb_client.query(
        TableName=DOCUMENTS_TABLE_NAME,
        IndexName=DOCUMENTS_BY_STATUS_INDEX,
        KeyConditionExpression="#status = :status AND #document_type = :document_type",
        ExpressionAttributeNames={
            "#status": "status",
            "#document_type": "document_type",
        },
        ExpressionAttributeValues={
            ":status": {
                "S": "enabled",
            },
            ":document_type": {
                "S": "rssfeed",
            },
        },
    )
    if feeds_to_crawl["Count"] > 0:
        for item in feeds_to_crawl["Items"]:
            workspace_id = item["workspace_id"]["S"]
            document_id = item["document_id"]["S"]
            _trigger_rss_feed_ingestor(workspace_id, document_id)


def _trigger_rss_feed_ingestor(
    workspace_id: str,
    document_id: str,
):
    try:
        response = lambda_client.invoke(
            FunctionName=RSS_FEED_INGESTOR_FUNCTION,
            InvocationType="Event",
            Payload=json.dumps(
                {
                    "workspace_id": workspace_id,
                    "document_id": document_id,
                }
            ),
        )
        logger.info("Response for _trigger_rss_feed_ingestor", response=response)
    except Exception as e:
        logger.exception(e)


def _toggle_document_subscription(
    workspace_id: str,
    document_id: str,
    enable: bool,
):
    subscription_status = "enabled" if enable else "disabled"
    set_status(workspace_id, document_id, subscription_status)


def enable_document_subscription(
    workspace_id: str,
    document_id: str,
):
    _toggle_document_subscription(workspace_id, document_id, True)


def disable_document_subscription(
    workspace_id: str,
    document_id: str,
):
    _toggle_document_subscription(workspace_id, document_id, False)


def check_rss_feed_for_posts(workspace_id, document_id):
    workspace = genai_core.workspaces.get_workspace(workspace_id)
    if not workspace:
        raise genai_core.types.CommonError("Workspace not found")

    rss_document = get_document(workspace_id, document_id)
    if not rss_document:
        raise genai_core.types.CommonError("Document not found")

    feed_path = rss_document["path"]
    logger.info(f"Parsing RSS Feed for {feed_path}")
    try:
        feed_contents = feedparser.parse(feed_path)
        if feed_contents:
            for feed_entry in feed_contents.entries:
                timestamp = _get_timestamp()
                post_id = str(_get_hash_id_from_path(feed_entry.get("link", "")))
                document = {
                    "format_version": 1,
                    "workspace_id": workspace_id,
                    "document_id": post_id,
                    "rss_feed_id": document_id,
                    "document_type": "rsspost",
                    "document_sub_type": None,
                    "sub_documents": None,
                    "compound_sort_key": f"rsspost/{document_id}/{post_id}",
                    "status": "pending",
                    "title": feed_entry.get("title", ""),
                    "path": feed_entry.get("link", ""),
                    "size_in_bytes": 0,
                    "vectors": 0,
                    "errors": [],
                    "created_at": timestamp,
                    "updated_at": timestamp,
                    "crawler_properties": rss_document.get("crawler_properties", None),
                }
                try:
                    documents_table.put_item(
                        Item=document,
                        ConditionExpression="attribute_not_exists(document_id)",
                    )
                except botocore.exceptions.ClientError as e:
                    if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
                        logger.info(f"Post already exists: {feed_entry['link']}")
                        continue
                    else:
                        raise e
        update_subscription_timestamp(workspace_id, document_id)
    except Exception as e:
        raise genai_core.types.CommonError("Error parsing feed", e)


def _get_hash_id_from_path(path):
    """Returns a hash id from a path
    This is useful if the ID needs to be NON-unique.
    """
    return hashlib.sha256(path.encode("utf-8")).hexdigest()


def batch_crawl_websites():
    """Gets next 10 pending posts and sends them to be website crawled"""
    posts = _get_batch_pending_posts()
    if posts["Count"] > 0:
        for post in posts["Items"]:
            workspace_id = post["workspace_id"]["S"]
            feed_id = post["rss_feed_id"]["S"]
            document_id = post["document_id"]["S"]
            path = post["path"]["S"]

            properties = post["crawler_properties"]

            follow_links = True
            if (
                properties
                and properties["M"]
                and properties["M"]["follow_links"]
                and properties["M"]["follow_links"]["BOOL"] == False
            ):
                follow_links = False

            limit = 250
            if (
                properties
                and properties["M"]
                and properties["M"]["limit"]
                and properties["M"]["limit"]["N"]
            ):
                limit = int(post["crawler_properties"]["M"]["limit"]["N"])

            content_types = []
            if (
                properties
                and properties["M"]
                and properties["M"]["content_types"]
                and properties["M"]["content_types"]["L"]
            ):
                for type in post["crawler_properties"]["M"]["content_types"]["L"]:
                    content_types.append(type["S"])
            else:
                content_types.append("text/html")

            create_document(
                workspace_id,
                "website",
                path=path,
                crawler_properties={
                    "follow_links": follow_links,
                    "limit": limit,
                    "content_types": content_types,
                },
            )
            set_status(workspace_id, document_id, "processed")
            update_subscription_timestamp(workspace_id, feed_id)


def _get_batch_pending_posts():
    """Gets the first 10 Pending Posts from the RSS Feed to Crawl"""
    return dynamodb_client.query(
        TableName=DOCUMENTS_TABLE_NAME,
        IndexName=DOCUMENTS_BY_STATUS_INDEX,
        Limit=10,
        KeyConditionExpression="#status = :status and #document_type = :document_type",
        ExpressionAttributeValues={
            ":status": {"S": "pending"},
            ":document_type": {"S": "rsspost"},
        },
        ExpressionAttributeNames={
            "#status": "status",
            "#document_type": "document_type",
        },
    )
