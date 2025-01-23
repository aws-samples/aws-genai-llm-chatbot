import os
import socket
import ipaddress
from common.constant import (
    ID_FIELD_VALIDATION,
    ID_FIELD_VALIDATION_OPTIONAL,
    SAFE_STR_REGEX,
    MAX_STR_INPUT_LENGTH,
    SAFE_SHORT_STR_VALIDATION,
    UserRole,
)
import genai_core.types
import genai_core.presign
import genai_core.documents
import genai_core.auth
from pydantic import BaseModel, Field, HttpUrl, IPvAnyAddress
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler.appsync import Router
from typing import Annotated, List, Optional
from genai_core.auth import UserPermissions

tracer = Tracer()
router = Router()
logger = Logger()
permissions = UserPermissions(router)

CONTENT_TYPE_VALDIATION = Field(
    min_length=1, max_length=100, pattern=r"^[A-Za-z0-9-_./]*$"
)


class FileUploadRequest(BaseModel):
    workspaceId: Optional[str] = ID_FIELD_VALIDATION_OPTIONAL
    fileName: str = Field(min_length=1, max_length=500, pattern=SAFE_STR_REGEX)


class TextDocumentRequest(BaseModel):
    workspaceId: str = ID_FIELD_VALIDATION
    title: str = Field(min_length=1, max_length=500, pattern=SAFE_STR_REGEX)
    content: str = Field(min_length=1, max_length=500)


class QnADocumentRequest(BaseModel):
    workspaceId: str = ID_FIELD_VALIDATION
    question: str = Field(min_length=1, max_length=MAX_STR_INPUT_LENGTH)
    answer: str = Field(min_length=1, max_length=MAX_STR_INPUT_LENGTH)


class WebsiteDocumentRequest(BaseModel):
    workspaceId: str = ID_FIELD_VALIDATION
    sitemap: bool
    address: HttpUrl
    followLinks: bool
    limit: int = Field(gt=-1)
    contentTypes: Optional[List[Annotated[str, CONTENT_TYPE_VALDIATION]]] = Field(
        default=None, max_length=10
    )


class RssFeedDocumentRequest(BaseModel):
    workspaceId: str = ID_FIELD_VALIDATION
    documentId: Optional[str] = Field(
        default=None, min_length=1, max_length=100, pattern=SAFE_STR_REGEX
    )
    address: Optional[HttpUrl] = Field(default=None)
    limit: int = Field(gt=-1)
    title: Optional[str] = Field(
        default=None, min_length=1, max_length=100, pattern=SAFE_STR_REGEX
    )
    followLinks: bool
    contentTypes: Optional[List[Annotated[str, CONTENT_TYPE_VALDIATION]]] = Field(
        default=None, max_length=10
    )


class RssFeedCrawlerUpdateRequest(BaseModel):
    workspaceId: str = ID_FIELD_VALIDATION
    documentId: str = ID_FIELD_VALIDATION
    followLinks: bool
    limit: int = Field(lt=500)
    contentTypes: Optional[List[Annotated[str, CONTENT_TYPE_VALDIATION]]] = Field(
        default=None, max_length=10
    )


class ListDocumentsRequest(BaseModel):
    workspaceId: str = ID_FIELD_VALIDATION
    documentType: str = SAFE_SHORT_STR_VALIDATION
    lastDocumentId: Optional[str] = Field(
        default=None, min_length=1, max_length=100, pattern=SAFE_STR_REGEX
    )


class GetDocumentRequest(BaseModel):
    workspaceId: str = ID_FIELD_VALIDATION
    documentId: str = ID_FIELD_VALIDATION


class DeleteDocumentRequest(BaseModel):
    workspaceId: str = ID_FIELD_VALIDATION
    documentId: str = ID_FIELD_VALIDATION


class GetRssPostsRequest(BaseModel):
    workspaceId: str = ID_FIELD_VALIDATION
    documentId: str = ID_FIELD_VALIDATION
    lastDocumentId: Optional[str] = Field(
        default=None, min_length=1, max_length=100, pattern=SAFE_STR_REGEX
    )


class DocumentSubscriptionStatusRequest(BaseModel):
    workspaceId: str = ID_FIELD_VALIDATION
    documentId: str = ID_FIELD_VALIDATION
    status: str = Field(
        default=None, min_length=1, max_length=100, pattern=SAFE_STR_REGEX
    )


allowed_workspace_extensions = set(
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

allowed_session_extensions = set(
    [
        ".jpg",
        ".jpeg",
        ".png",
        ".pdf",
        ".csv",
        ".doc",
        ".docx",
        ".xls",
        ".xlsx",
        ".html",
        ".txt",
        ".md",
        ".mp4",
    ]
)


@router.resolver(field_name="getUploadFileURL")
@tracer.capture_method
def file_upload(input: dict):
    request = FileUploadRequest(**input)
    _, extension = os.path.splitext(request.fileName)

    user_roles = genai_core.auth.get_user_roles(router)
    if user_roles is None:
        raise genai_core.types.CommonError("User does not have any roles")

    if "workspaceId" in input:
        if (
            UserRole.ADMIN.value not in user_roles
            and UserRole.WORKSPACE_MANAGER.value not in user_roles
        ):
            raise genai_core.types.CommonError("Unauthorized")

        if extension not in allowed_workspace_extensions:
            raise genai_core.types.CommonError(
                f"""Invalid file extension {extension}.
                Allowed extensions: {allowed_workspace_extensions}."""
            )

        result = genai_core.presign.generate_workspace_presigned_post(
            request.workspaceId, request.fileName
        )
    else:
        if extension not in allowed_session_extensions:
            raise genai_core.types.CommonError(
                f"""Invalid file extension {extension}.
                Allowed extensions: {allowed_session_extensions}."""
            )

        user_id = genai_core.auth.get_user_id(router)
        result = genai_core.presign.generate_user_presigned_post(
            user_id, request.fileName
        )

    logger.info("Generated pre-signed for " + request.fileName)
    return result


@router.resolver(field_name="listDocuments")
@tracer.capture_method
@permissions.approved_roles(
    [permissions.ADMIN_ROLE, permissions.WORKSPACES_MANAGER_ROLE]
)
def get_documents(input: dict):
    request = ListDocumentsRequest(**input)
    result = genai_core.documents.list_documents(
        request.workspaceId, request.documentType, request.lastDocumentId
    )

    return {
        "items": [_convert_document(item) for item in result["items"]],
        "lastDocumentId": result["last_document_id"],
    }


@router.resolver(field_name="deleteDocument")
@tracer.capture_method
@permissions.approved_roles(
    [permissions.ADMIN_ROLE, permissions.WORKSPACES_MANAGER_ROLE]
)
def delete_document(input: dict):
    request = DeleteDocumentRequest(**input)
    result = genai_core.documents.delete_document(
        request.workspaceId, request.documentId
    )
    return result


@router.resolver(field_name="getDocument")
@tracer.capture_method
@permissions.approved_roles(
    [permissions.ADMIN_ROLE, permissions.WORKSPACES_MANAGER_ROLE]
)
def get_document_details(input: dict):
    request = GetDocumentRequest(**input)

    result = genai_core.documents.get_document(request.workspaceId, request.documentId)

    if not result:
        return None

    return _convert_document(result)


@router.resolver(field_name="getRSSPosts")
@tracer.capture_method
@permissions.approved_roles(
    [permissions.ADMIN_ROLE, permissions.WORKSPACES_MANAGER_ROLE]
)
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
@permissions.approved_roles(
    [permissions.ADMIN_ROLE, permissions.WORKSPACES_MANAGER_ROLE]
)
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
@permissions.approved_roles(
    [permissions.ADMIN_ROLE, permissions.WORKSPACES_MANAGER_ROLE]
)
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
@permissions.approved_roles(
    [permissions.ADMIN_ROLE, permissions.WORKSPACES_MANAGER_ROLE]
)
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
@permissions.approved_roles(
    [permissions.ADMIN_ROLE, permissions.WORKSPACES_MANAGER_ROLE]
)
def add_website(input: dict):
    request = WebsiteDocumentRequest(**input)

    if _is_ip_address(request.address.host):
        raise genai_core.types.CommonError("URLs containing IPs are not allowed.")
    if _is_hostname_internal(request.address.host):
        raise genai_core.types.CommonError("Invalid URL.")

    path = str(request.address)
    document_sub_type = "sitemap" if request.sitemap else None
    limit = min(max(request.limit, 1), 1000)

    result = genai_core.documents.create_document(
        workspace_id=request.workspaceId,
        document_type="website",
        document_sub_type=document_sub_type,
        path=path,
        crawler_properties={
            "follow_links": request.followLinks,
            "limit": limit,
            "content_types": request.contentTypes,
        },
    )

    return {
        "workspaceId": result["workspace_id"],
        "documentId": result["document_id"],
    }


@router.resolver(field_name="addRssFeed")
@tracer.capture_method
@permissions.approved_roles(
    [permissions.ADMIN_ROLE, permissions.WORKSPACES_MANAGER_ROLE]
)
def add_rss_feed(
    input: dict,
):
    request = RssFeedDocumentRequest(**input)
    if request.address == None:
        raise genai_core.types.CommonError("address is not set")
    path = str(request.address)
    if _is_ip_address(request.address.host):
        raise genai_core.types.CommonError("URLs containing IPs are not allowed.")
    if _is_hostname_internal(request.address.host):
        raise genai_core.types.CommonError("Invalid URL.")

    limit = min(max(request.limit, 1), 1000)

    result = genai_core.documents.create_document(
        workspace_id=request.workspaceId,
        document_type="rssfeed",
        path=path,
        title=request.title,
        crawler_properties={
            "follow_links": request.followLinks,
            "limit": limit,
            "content_types": request.contentTypes,
        },
    )

    return {
        "workspaceId": result["workspace_id"],
        "documentId": result["document_id"],
    }


@router.resolver(field_name="updateRssFeed")
@tracer.capture_method
@permissions.approved_roles(
    [permissions.ADMIN_ROLE, permissions.WORKSPACES_MANAGER_ROLE]
)
def update_rss_feed(input: dict):
    request = RssFeedCrawlerUpdateRequest(**input)
    if request.documentId == None:
        raise genai_core.types.CommonError("documentId is not set")
    if request.limit == None:
        raise genai_core.types.CommonError("limit is not set")

    limit = min(max(request.limit, 1), 1000)
    genai_core.documents.update_document(
        workspace_id=request.workspaceId,
        document_id=request.documentId,
        document_type="rssfeed",
        follow_links=request.followLinks,
        limit=limit,
        content_types=request.contentTypes,
    )
    return {
        "workspaceId": request.workspaceId,
        "documentId": request.documentId,
        "status": "updated",
    }


def _convert_document(document: dict):
    converted_document = {
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
    }
    if "crawler_properties" in document:
        converted_document["crawlerProperties"] = {
            "followLinks": document.get("crawler_properties").get("follow_links", None),
            "limit": document.get("crawler_properties").get("limit", None),
            "contentTypes": document.get("crawler_properties").get(
                "content_types", None
            ),
        }

    return converted_document


def _is_ip_address(host):
    try:
        IPvAnyAddress(host)
        return True
    except ValueError as e:
        logger.debug(e)
        return False


def _is_hostname_internal(host):
    try:
        ip = socket.gethostbyname(host)
        return ipaddress.ip_address(ip).is_private
    except socket.gaierror as e:
        logger.debug(e)
        return False
