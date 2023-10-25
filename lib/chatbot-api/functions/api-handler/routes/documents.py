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


def _convert_document(document: dict):
    return {
        "id": document["document_id"],
        "type": document["document_type"],
        "subType": document["document_sub_type"],
        "status": document["status"],
        "title": document["title"],
        "path": document["path"],
        "sizeInBytes": document["size_in_bytes"],
        "vectors": document["vectors"],
        "subDocuments": document["sub_documents"],
        "errors": document["errors"],
        "createdAt": document["created_at"],
        "updatedAt": document["updated_at"],
    }
