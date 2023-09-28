import os
import json
import uuid
import boto3
import genai_core.types
import genai_core.chunks
import genai_core.websites
import genai_core.utils.json
import genai_core.workspaces
import genai_core.utils.files
from typing import Optional
from datetime import datetime
from aws_lambda_powertools import Logger

PROCESSING_BUCKET_NAME = os.environ["PROCESSING_BUCKET_NAME"]
WORKSPACES_TABLE_NAME = os.environ["WORKSPACES_TABLE_NAME"]
DOCUMENTS_TABLE_NAME = os.environ.get("DOCUMENTS_TABLE_NAME")
DOCUMENTS_BY_COMPOUND_KEY_INDEX_NAME = os.environ.get(
    "DOCUMENTS_BY_COMPOUND_KEY_INDEX_NAME"
)
FILE_IMPORT_WORKFLOW_ARN = os.environ.get("FILE_IMPORT_WORKFLOW_ARN")
WEBSITE_CRAWLING_WORKFLOW_ARN = os.environ.get("WEBSITE_CRAWLING_WORKFLOW_ARN")
DEFAULT_KENDRA_S3_DATA_SOURCE_BUCKET_NAME = os.environ.get(
    "DEFAULT_KENDRA_S3_DATA_SOURCE_BUCKET_NAME"
)

WORKSPACE_OBJECT_TYPE = "workspace"

logger = Logger()

s3 = boto3.resource("s3")
s3_client = boto3.client("s3")
dynamodb = boto3.resource("dynamodb")
sfn_client = boto3.client("stepfunctions")

documents_table = dynamodb.Table(DOCUMENTS_TABLE_NAME)
workspaces_table = dynamodb.Table(WORKSPACES_TABLE_NAME)


def list_documents(
    workspace_id: str,
    document_type: str,
    last_document_id: str = None,
    page_size: int = 100,
):
    workspace = genai_core.workspaces.get_workspace(workspace_id)
    if not workspace:
        raise genai_core.types.CommonError("Workspace not found")

    scan_index_forward = True
    if document_type == "text" or document_type == "qna":
        scan_index_forward = False

    if last_document_id:
        last_document = get_document(workspace_id, last_document_id)
        if not last_document:
            raise genai_core.types.CommonError("Last document not found")
        last_document_compound_sort_key = last_document["compound_sort_key"]

        response = documents_table.query(
            IndexName=DOCUMENTS_BY_COMPOUND_KEY_INDEX_NAME,
            KeyConditionExpression="workspace_id = :workspace_id AND begins_with(compound_sort_key, :sort_key_prefix)",
            ExclusiveStartKey={
                "workspace_id": workspace_id,
                "document_id": last_document_id,
                "compound_sort_key": last_document_compound_sort_key,
            },
            ExpressionAttributeValues={
                ":workspace_id": workspace_id,
                ":sort_key_prefix": f"{document_type}/",
            },
            Limit=page_size,
            ScanIndexForward=scan_index_forward,
        )
    else:
        response = documents_table.query(
            IndexName=DOCUMENTS_BY_COMPOUND_KEY_INDEX_NAME,
            KeyConditionExpression="workspace_id = :workspace_id AND begins_with(compound_sort_key, :sort_key_prefix)",
            ExpressionAttributeValues={
                ":workspace_id": workspace_id,
                ":sort_key_prefix": f"{document_type}/",
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
    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%fZ")

    response = workspaces_table.update_item(
        Key={"workspace_id": workspace_id, "object_type": WORKSPACE_OBJECT_TYPE},
        UpdateExpression="ADD vectors :incrementValue SET updated_at=:timestampValue",
        ExpressionAttributeValues={
            ":incrementValue": vectors,
            ":timestampValue": timestamp,
        },
    )

    logger.info(response)

    if replace:
        response = documents_table.update_item(
            Key={"workspace_id": workspace_id, "document_id": document_id},
            UpdateExpression="SET vectors=:vectorsValue, updated_at=:timestampValue",
            ExpressionAttributeValues={
                ":vectorsValue": vectors,
                ":timestampValue": timestamp,
            },
        )
    else:
        response = documents_table.update_item(
            Key={"workspace_id": workspace_id, "document_id": document_id},
            UpdateExpression="ADD vectors :incrementValue SET updated_at=:timestampValue",
            ExpressionAttributeValues={
                ":incrementValue": vectors,
                ":timestampValue": timestamp,
            },
        )

    logger.info(response)

    return response


def set_sub_documents(workspace_id: str, document_id: str, sub_documents: int):
    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%fZ")

    response = documents_table.update_item(
        Key={"workspace_id": workspace_id, "document_id": document_id},
        UpdateExpression="SET sub_documents=:subDocumentsValue, updated_at=:timestampValue",
        ExpressionAttributeValues={
            ":subDocumentsValue": sub_documents,
            ":timestampValue": timestamp,
        },
    )

    logger.info(response)

    return response


def get_document(workspace_id: str, document_id: str):
    response = documents_table.get_item(
        Key={"workspace_id": workspace_id, "document_id": document_id}
    )
    document = response.get("Item")

    return document


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
    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%fZ")

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
):
    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%fZ")
    workspace = genai_core.workspaces.get_workspace(workspace_id)
    if not workspace:
        return None

    document = None
    unique_path_document = document_type in ["file", "website"]
    if unique_path_document:
        response = documents_table.query(
            IndexName=DOCUMENTS_BY_COMPOUND_KEY_INDEX_NAME,
            KeyConditionExpression="workspace_id=:workspaceValue AND compound_sort_key=:compoundKeyValue",
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
            UpdateExpression="SET compound_sort_key=:compoundKeyValue, #status=:statusValue, size_in_bytes=:sizeValue, vectors=:vectorsValue, updated_at=:timestampValue",
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
        if document_type in ["file", "website"]:
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

        response = documents_table.put_item(Item=document)
        logger.info(response)

    size_diff = size_in_bytes - current_size_in_bytes
    response = workspaces_table.update_item(
        Key={"workspace_id": workspace_id, "object_type": WORKSPACE_OBJECT_TYPE},
        UpdateExpression="ADD size_in_bytes :incrementValue, documents :documentsIncrementValue, vectors :vectorsIncrementValue SET updated_at=:timestampValue",
        ExpressionAttributeValues={
            ":incrementValue": size_diff,
            ":documentsIncrementValue": documents_diff,
            ":vectorsIncrementValue": -current_vectors,
            ":timestampValue": timestamp,
        },
        ReturnValues="UPDATED_NEW",
    )

    logger.info(response)

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
            workspace, document, content=content, content_complement=content_complement
        )

    return {
        "workspace_id": workspace_id,
        "document_id": document_id,
    }


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
):
    workspace_id = workspace["workspace_id"]
    document_id = document["document_id"]
    document_type = document["document_type"]

    if document_type == "text":
        response = sfn_client.start_execution(
            stateMachineArn=FILE_IMPORT_WORKFLOW_ARN,
            input=json.dumps(
                {
                    "convert_to_text": False,
                    "workspace_id": workspace_id,
                    "document_id": document_id,
                    "processing_bucket_name": PROCESSING_BUCKET_NAME,
                    "processing_object_key": f"{workspace_id}/{document_id}/content.txt",
                }
            ),
        )

        logger.info(response)
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
        follow_links = True
        if document_sub_type == "sitemap":
            follow_links = False

            try:
                urls_to_crawl = genai_core.websites.extract_urls_from_sitemap(path)

                if len(urls_to_crawl) == 0:
                    set_status(workspace_id, document_id, "error")
                    raise genai_core.types.CommonError("No urls found in sitemap")
            except Exception as e:
                logger.error(e)
                set_status(workspace_id, document_id, "error")
                raise genai_core.types.CommonError("Error extracting urls from sitemap")

        response = sfn_client.start_execution(
            stateMachineArn=WEBSITE_CRAWLING_WORKFLOW_ARN,
            input=json.dumps(
                {
                    "workspace_id": workspace_id,
                    "document_id": document_id,
                    "workspace": workspace,
                    "document": document,
                    "limit": 100,
                    "follow_links": follow_links,
                    "urls_to_crawl": urls_to_crawl,
                    "processed_urls": [],
                },
                cls=genai_core.utils.json.CustomEncoder,
            ),
        )

        logger.info(response)


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
