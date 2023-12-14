import os
import genai_core.types
import genai_core.upload
import genai_core.documents
from pydantic import BaseModel
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler.appsync import Router
from typing import Optional

tracer = Tracer()
router = Router()
logger = Logger()


class FileUploadRequest(BaseModel):
    workspaceId: str
    fileName: str


class TextDocumentRequest(BaseModel):
    workspaceId: str
    title: str
    content: str


class QnADocumentRequest(BaseModel):
    workspaceId: str
    question: str
    answer: str


class WebsiteDocumentRequest(BaseModel):
    workspaceId: str
    sitemap: bool
    address: str
    followLinks: bool
    limit: int


class RssFeedDocumentRequest(BaseModel):
    workspaceId: str
    documentId: Optional[str]
    address: Optional[str]
    limit: int
    title: Optional[str]
    followLinks: bool


class RssFeedCrawlerUpdateRequest(BaseModel):
    documentType: str
    followLinks: bool
    limit: int


class ListDocumentsRequest(BaseModel):
    workspaceId: str
    documentType: str
    lastDocumentId: Optional[str]


class GetDocumentRequest(BaseModel):
    workspaceId: str
    documentId: str


class GetRssPostsRequest(BaseModel):
    workspaceId: str
    documentId: str
    lastDocumentId: Optional[str]


class DocumentSubscriptionStatusRequest(BaseModel):
    workspaceId: str
    documentId: str
    status: str


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


@router.resolver(field_name="getUploadFileURL")
@tracer.capture_method
def file_upload(input: dict):
    request = FileUploadRequest(**input)
    _, extension = os.path.splitext(request.fileName)
    if extension not in allowed_extensions:
        raise genai_core.types.CommonError("Invalid file extension")

    result = genai_core.upload.generate_presigned_post(
        request.workspaceId, request.fileName
    )

    print(result)
    return result


@router.resolver(field_name="listDocuments")
@tracer.capture_method
def get_documents(input: dict):
    request = ListDocumentsRequest(**input)
    result = genai_core.documents.list_documents(
        request.workspaceId, request.documentType, request.lastDocumentId
    )

    return {
        "items": [_convert_document(item) for item in result["items"]],
        "lastDocumentId": result["last_document_id"],
    }


@router.resolver(field_name="getDocument")
@tracer.capture_method
def get_document_details(input: dict):
    request = GetDocumentRequest(**input)

    result = genai_core.documents.get_document(request.workspaceId, request.documentId)

    return _convert_document(result)


@router.resolver(field_name="getRSSPosts")
@tracer.capture_method
def get_rss_posts(input: dict):
    request = GetRssPostsRequest(**input)

    result = genai_core.documents.list_documents(
        workspace_id=request.workspaceId,
        document_type="rsspost",
        last_document_id=request.lastDocumentId,
        parent_document_id=request.documentId,
    )

    return {
        "items": [_convert_document(item) for item in result["items"]],
        "lastDocumentId": result["last_document_id"],
    }


@router.resolver(field_name="setDocumentSubscriptionStatus")
@tracer.capture_method
def enable_document(input: dict):
    request = DocumentSubscriptionStatusRequest(**input)

    if request.status not in ["enabled", "disabled"]:
        raise genai_core.types.CommonError("Invalid status")
    if request.status == "enabled":
        result = genai_core.documents.enable_document_subscription(
            request.workspaceId, request.documentId
        )
    else:
        result = genai_core.documents.disable_document_subscription(
            request.workspaceId, request.documentId
        )

    return {
        "workspaceId": request.workspaceId,
        "documentId": request.documentId,
        "status": result,
    }


@router.resolver(field_name="addTextDocument")
@tracer.capture_method
def add_text_document(input: dict):
    request = TextDocumentRequest(**input)
    title = request.title.strip()[:1000]
    content = request.content.strip()[:10000]
    result = genai_core.documents.create_document(
        workspace_id=request.workspaceId,
        document_type="text",
        title=title,
        content=content,
    )

    return {
        "workspaceId": result["workspace_id"],
        "documentId": result["document_id"],
    }


@router.resolver(field_name="addQnADocument")
@tracer.capture_method
def add_qna_document(input: dict):
    request = QnADocumentRequest(**input)
    question = request.question.strip()[:1000]
    answer = request.answer.strip()[:1000]
    result = genai_core.documents.create_document(
        workspace_id=request.workspaceId,
        document_type="qna",
        title=question,
        content=question,
        content_complement=answer,
    )

    return {
        "workspaceId": result["workspace_id"],
        "documentId": result["document_id"],
    }


@router.resolver(field_name="addWebsite")
@tracer.capture_method
def add_website(input: dict):
    request = WebsiteDocumentRequest(**input)

    address = request.address.strip()[:10000]
    document_sub_type = "sitemap" if request.sitemap else None
    limit = min(max(request.limit, 1), 1000)

    result = genai_core.documents.create_document(
        workspace_id=request.workspaceId,
        document_type="website",
        document_sub_type=document_sub_type,
        path=address,
        crawler_properties={
            "follow_links": request.followLinks,
            "limit": limit,
        },
    )

    return {
        "workspaceId": result["workspace_id"],
        "documentId": result["document_id"],
    }


@router.resolver(field_name="addRssFeed")
@tracer.capture_method
def add_rss_feed(
    input: dict,
):
    request = RssFeedDocumentRequest(**input)
    address = request.address.strip()[:10000]
    path = address

    result = genai_core.documents.create_document(
        workspace_id=request.workspaceId,
        document_type="rssfeed",
        path=path,
        title=request.title,
        crawler_properties={
            "follow_links": request.followLinks,
            "limit": request.limit,
        },
    )

    return {
        "workspaceId": result["workspace_id"],
        "documentId": result["document_id"],
    }


@router.resolver(field_name="updateRSSFeed")
@tracer.capture_method
def update_rss_feed(input: dict):
    request = RssFeedDocumentRequest(**input)
    result = genai_core.documents.update_document(
        workspace_id=request.workspaceId,
        document_id=request.documentId,
        document_type="rssfeed",
        follow_links=request.followLinks,
        limit=request.limit,
    )
    return {
        "workspaceId": result["workspace_id"],
        "documentId": result["document_id"],
        "status": "updated",
    }


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
