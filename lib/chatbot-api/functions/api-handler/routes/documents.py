import os
import genai_core.types
import genai_core.upload
import genai_core.documents
from pydantic import BaseModel
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler.api_gateway import Router

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


@router.post("/workspaces/<workspace_id>/documents/file-upload")
@tracer.capture_method
def file_upload(workspace_id: str):
    data: dict = router.current_event.json_body
    request = FileUploadRequest(**data)

    _, extension = os.path.splitext(request.fileName)
    if extension not in allowed_extensions:
        raise genai_core.types.CommonError("Invalid file extension")

    result = genai_core.upload.generate_presigned_post(workspace_id, request.fileName)

    return {"ok": True, "data": result}


@router.get("/workspaces/<workspace_id>/documents/<document_type>")
@tracer.capture_method
def get_documents(workspace_id: str, document_type: str):
    query_string = router.current_event.query_string_parameters or {}
    last_document_id = query_string.get("lastDocumentId", None)

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


@router.get("/workspaces/<workspace_id>/documents/<document_id>/detail")
@tracer.capture_method
def get_document_details(workspace_id: str, document_id: str):
    result = genai_core.documents.get_document(workspace_id, document_id)

    return {
        "ok": True,
        "data": {
            "items":[_convert_document(result)],
            "lastDocumentId": None
        }
    }

@router.get("/workspaces/<workspace_id>/documents/<document_id>/posts")
@tracer.capture_method
def get_rss_posts(workspace_id: str, document_id: str):
    query_string = router.current_event.query_string_parameters or {}
    last_document_id = query_string.get("lastDocumentId", None)

    result = genai_core.documents.list_documents(
        workspace_id, "rsspost", last_document_id=last_document_id, 
        parent_document_id=document_id
    )

    return {
        "ok": True,
        "data": {
            "items": [_convert_document(item) for item in result["items"]],
            "lastDocumentId": result["last_document_id"],
        },
    }

@router.get("/workspaces/<workspace_id>/documents/<document_id>/enable")
@tracer.capture_method
def enable_document(workspace_id: str, document_id: str):
    result = genai_core.documents.enable_document_subscription(workspace_id, document_id)

    return {
        "ok": True,
        "data": {
            "workspaceId": workspace_id,
            "documentId": document_id,
            "status": "enabled"
        }
    }

@router.get("/workspaces/<workspace_id>/documents/<document_id>/disable")
@tracer.capture_method
def disable_document(workspace_id: str, document_id: str):
    result = genai_core.documents.disable_document_subscription(workspace_id, document_id)

    return {
        "ok": True,
        "data": {
            "workspaceId": workspace_id,
            "documentId": document_id,
            "status": "disabled"
        }
    }


@router.post("/workspaces/<workspace_id>/documents/<document_type>")
@tracer.capture_method
def add_document(workspace_id: str, document_type: str):
    data: dict = router.current_event.json_body

    if document_type == "text":
        request = TextDocumentRequest(**data)
        request.title = request.title.strip()[:1000]
        result = genai_core.documents.create_document(
            workspace_id=workspace_id,
            document_type=document_type,
            title=request.title,
            content=request.content,
        )

        return {
            "ok": True,
            "data": {
                "workspaceId": result["workspace_id"],
                "documentId": result["document_id"],
            },
        }
    elif document_type == "qna":
        request = QnADocumentRequest(**data)
        request.question = request.question.strip()[:1000]
        request.answer = request.answer.strip()[:1000]
        result = genai_core.documents.create_document(
            workspace_id=workspace_id,
            document_type=document_type,
            title=request.question,
            content=request.question,
            content_complement=request.answer,
        )

        return {
            "ok": True,
            "data": {
                "workspaceId": result["workspace_id"],
                "documentId": result["document_id"],
            },
        }
    elif document_type == "website":
        request = WebsiteDocumentRequest(**data)
        request.address = request.address.strip()[:10000]
        document_sub_type = "sitemap" if request.sitemap else None
        request.limit = min(max(request.limit, 1), 1000)

        result = genai_core.documents.create_document(
            workspace_id=workspace_id,
            document_type=document_type,
            document_sub_type=document_sub_type,
            path=request.address,
            crawler_properties={
                "follow_links": request.followLinks,
                "limit": request.limit,
            },
        )

        return {
            "ok": True,
            "data": {
                "workspaceId": result["workspace_id"],
                "documentId": result["document_id"],
            },
        }
    
    elif document_type == "rssfeed":
        request = RssFeedDocumentRequest(**data)
        request.address = request.address.strip()[:10000]
        path=request.address

        result = genai_core.documents.create_document(
            workspace_id=workspace_id,
            document_type=document_type,
            path=path,
            title=request.title,
            crawler_properties={
                "follow_links": request.followLinks,
                "limit": request.limit,
            },
        )

        return {
            "ok": True,
            "data": {
                "workspaceId": result["workspace_id"],
                "documentId": result["document_id"],
            }
        }
    
@router.patch("/workspaces/<workspace_id>/documents/<document_id>/")
@tracer.capture_method
def update_document(workspace_id: str, document_id: str):
    data: dict = router.current_event.json_body
    if "documentType" in data:
        if data["documentType"] == "rssfeed":
            request = RssFeedCrawlerUpdateRequest(**data)
            result = genai_core.documents.update_document(
                workspace_id=workspace_id,
                document_id=document_id,
                document_type=request.documentType,
                follow_links=request.followLinks,
                limit=request.limit,
            )
            return {
                "ok": True,
                "data": "done"
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
        "rssLastCheckedAt": document.get("rss_last_checked",None),
        "crawlerProperties":  {
            "followLinks": document.get("crawler_properties").get("follow_links",None),
            "limit": document.get("crawler_properties").get("limit",None)
        } if document.get("crawler_properties", None) != None else None
    }
