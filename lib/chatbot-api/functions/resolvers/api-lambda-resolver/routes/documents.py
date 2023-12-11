import os
import genai_core.types
import genai_core.upload
import genai_core.documents
from pydantic import BaseModel
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler.appsync import Router

tracer = Tracer()
router = Router()
logger = Logger()


class FileUploadRequest(BaseModel):
    fileName: str


class TextDocumentRequest(BaseModel):
    title: str
    content: str


class QnADocumentRequest(BaseModel):
    question: str
    answer: str


class WebsiteDocumentRequest(BaseModel):
    sitemap: bool
    address: str
    followLinks: bool
    limit: int


class RssFeedDocumentRequest(BaseModel):
    address: str
    limit: int
    title: str
    followLinks: bool


class RssFeedCrawlerUpdateRequest(BaseModel):
    documentType: str
    followLinks: bool
    limit: int


allowed_extensions = set(
    [
        ".csv",
        ".doc",
        ".docx",
        ".epub",
        ".odt",
        ".pdf",
        ".ppt",
        ".pptx",
        ".tsv",
        ".xlsx",
        ".eml",
        ".html",
        ".json",
        ".md",
        ".msg",
        ".rst",
        ".rtf",
        ".txt",
        ".xml",
    ]
)


@router.resolver(field_name="uploadFile")
@tracer.capture_method
def file_upload(workspace_id: str, file_name: str):
    _, extension = os.path.splitext(file_name)
    if extension not in allowed_extensions:
        raise genai_core.types.CommonError("Invalid file extension")

    result = genai_core.upload.generate_presigned_post(workspace_id, file_name)

    return {"ok": True, "data": result}


@router.resolver(field_name="getDocuments")
@tracer.capture_method
def get_documents(
    workspace_id: str, document_type: str, last_document_id: str | None = None
):
    result = genai_core.documents.list_documents(
        workspace_id, document_type, last_document_id
    )

    return {
        "ok": True,
        "data": {
            "items": [_convert_document(item) for item in result["items"]],
            "lastDocumentId": result["last_document_id"],
        },
    }


@router.resolver(field_name="getDocumentDetails")
@tracer.capture_method
def get_document_details(workspace_id: str, document_id: str):
    result = genai_core.documents.get_document(workspace_id, document_id)

    return {
        "ok": True,
        "data": {"items": [_convert_document(result)], "lastDocumentId": None},
    }


@router.resolver(field_name="getRSSPosts")
@tracer.capture_method
def get_rss_posts(workspace_id: str, document_id: str):
    query_string = router.current_event.query_string_parameters or {}
    last_document_id = query_string.get("lastDocumentId", None)

    result = genai_core.documents.list_documents(
        workspace_id,
        "rsspost",
        last_document_id=last_document_id,
        parent_document_id=document_id,
    )

    return {
        "ok": True,
        "data": {
            "items": [_convert_document(item) for item in result["items"]],
            "lastDocumentId": result["last_document_id"],
        },
    }


@router.resolver(field_name="setDocumentSubscriptionStatus")
@tracer.capture_method
def enable_document(workspace_id: str, document_id: str, status: str):
    if status not in ["enabled", "disabled"]:
        raise genai_core.types.CommonError("Invalid status")
    if status == "enabled":
        result = genai_core.documents.enable_document_subscription(
            workspace_id, document_id
        )
    else:
        result = genai_core.documents.disable_document_subscription(
            workspace_id, document_id
        )

    return {
        "ok": True,
        "data": {
            "workspaceId": workspace_id,
            "documentId": document_id,
            "status": status,
        },
    }


@router.resolver(field_name="addTextDocument")
@tracer.capture_method
def add_text_document(workspace_id: str, title: str, content: str):
    title = title.strip()[:1000]
    result = genai_core.documents.create_document(
        workspace_id=workspace_id,
        document_type="text",
        title=title,
        content=content,
    )

    return {
        "ok": True,
        "data": {
            "workspaceId": result["workspace_id"],
            "documentId": result["document_id"],
        },
    }


@router.resolver(field_name="addQnADocument")
@tracer.capture_method
def add_qna_document(workspace_id: str, question: str, answer: str):
    question = question.strip()[:1000]
    answer = answer.strip()[:1000]
    result = genai_core.documents.create_document(
        workspace_id=workspace_id,
        document_type="qna",
        title=question,
        content=question,
        content_complement=answer,
    )

    return {
        "ok": True,
        "data": {
            "workspaceId": result["workspace_id"],
            "documentId": result["document_id"],
        },
    }


@router.resolver(field_name="addWebsite")
@tracer.capture_method
def add_website(
    workspace_id: str, sitemap: bool, address: str, followLinks: bool, limit: int
):
    address = request.address.strip()[:10000]
    document_sub_type = "sitemap" if sitemap else None
    request.limit = min(max(limit, 1), 1000)

    result = genai_core.documents.create_document(
        workspace_id=workspace_id,
        document_type="website",
        document_sub_type=document_sub_type,
        path=address,
        crawler_properties={
            "follow_links": followLinks,
            "limit": limit,
        },
    )

    return {
        "ok": True,
        "data": {
            "workspaceId": result["workspace_id"],
            "documentId": result["document_id"],
        },
    }


@router.resolver(field_name="addRSSFeed")
@tracer.capture_method
def add_rss_feed(
    workspace_id: str, address: str, limit: int, title: str, follow_links: bool
):
    address = address.strip()[:10000]
    path = address

    result = genai_core.documents.create_document(
        workspace_id=workspace_id,
        document_type="rssfeed",
        path=path,
        title=title,
        crawler_properties={
            "follow_links": follow_links,
            "limit": limit,
        },
    )

    return {
        "ok": True,
        "data": {
            "workspaceId": result["workspace_id"],
            "documentId": result["document_id"],
        },
    }


@router.resolver(field_name="updateRSSFeed")
@tracer.capture_method
def update_document(
    workspace_id: str, document_id: str, follow_links: bool, limit: int
):
    result = genai_core.documents.update_document(
        workspace_id=workspace_id,
        document_id=document_id,
        document_type="rssfeed",
        follow_links=follow_links,
        limit=limit,
    )
    return (
        {
            "ok": True,
            "data": {
                "workspaceId": result["workspace_id"],
                "documentId": result["document_id"],
                "status": "updated",
            },
        },
    )


def _convert_document(document: dict):
    if "crawler_properties" in document:
        document["crawler_properties"] = {
            "followLinks": document["crawler_properties"]["follow_links"],
            "limit": document["crawler_properties"]["limit"],
        }
    return {
        "id": document["document_id"],
        "workspaceId": document["workspace_id"],
        "type": document["document_type"],
        "subType": document.get("document_sub_type", None),
        "status": document["status"],
        "title": document["title"],
        "path": document["path"],
        "sizeInBytes": document.get("size_in_bytes", None),
        "vectors": document.get("vectors", None),
        "subDocuments": document.get("sub_documents", None),
        "errors": document.get("errors", None),
        "createdAt": document["created_at"],
        "updatedAt": document.get("updated_at", None),
        "rssFeedId": document.get("rss_feed_id", None),
        "rssLastCheckedAt": document.get("rss_last_checked", None),
        "crawlerProperties": {
            "followLinks": document.get("crawler_properties").get("follow_links", None),
            "limit": document.get("crawler_properties").get("limit", None),
        }
        if document.get("crawler_properties", None) != None
        else None,
    }
