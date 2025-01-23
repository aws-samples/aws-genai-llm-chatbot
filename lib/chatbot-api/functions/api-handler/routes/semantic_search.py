from common.constant import ID_FIELD_VALIDATION, SAFE_PROMPT_STR_REGEX
import genai_core.semantic_search
from pydantic import BaseModel, Field
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler.appsync import Router
from genai_core.auth import UserPermissions

tracer = Tracer()
router = Router()
logger = Logger()
permissions = UserPermissions(router)


class SemanticSearchRequest(BaseModel):
    workspaceId: str = ID_FIELD_VALIDATION
    query: str = Field(max_length=256, pattern=SAFE_PROMPT_STR_REGEX)


@router.resolver(field_name="performSemanticSearch")
@tracer.capture_method
@permissions.approved_roles(
    [permissions.ADMIN_ROLE, permissions.WORKSPACES_MANAGER_ROLE]
)
def semantic_search(input: dict):
    request = SemanticSearchRequest(**input)

    result = genai_core.semantic_search.semantic_search(
        workspace_id=request.workspaceId,
        query=request.query,
        limit=25,
        full_response=True,
    )
    result = _convert_semantic_search_result(request.workspaceId, result)

    return result


def _convert_semantic_search_result(workspace_id: str, result: dict):
    vector_search_items = result.get("vector_search_items")
    keyword_search_items = result.get("keyword_search_items")

    if vector_search_items:
        vector_search_items = [
            _convert_semantic_search_item(item) for item in vector_search_items
        ]

    if keyword_search_items:
        keyword_search_items = [
            _convert_semantic_search_item(item) for item in keyword_search_items
        ]

    items = [_convert_semantic_search_item(item) for item in result["items"]]

    ret_value = {
        "engine": result["engine"],
        "workspaceId": workspace_id,
        "queryLanguage": result.get("query_language", "en"),
        "supportedLanguages": result.get("supported_languages"),
        "detectedLanguages": result.get("detected_languages"),
        "items": items,
        "vectorSearchMetric": result.get("vector_search_metric"),
        "vectorSearchItems": vector_search_items,
        "keywordSearchItems": keyword_search_items,
    }

    return ret_value


def _convert_semantic_search_item(item: dict):
    ret_value = {
        "sources": item["sources"],
        "chunkId": item["chunk_id"],
        "workspaceId": item["workspace_id"],
        "documentId": item["document_id"],
        "documentSubId": item["document_sub_id"],
        "documentType": item["document_type"],
        "documentSubType": item["document_sub_type"],
        "path": item["path"],
        "language": item["language"],
        "title": item["title"],
        "content": item["content"],
        "contentComplement": item["content_complement"],
        "vectorSearchScore": item.get("vector_search_score", 0),
        "keywordSearchScore": item.get("keyword_search_score"),
        "score": item["score"],
    }

    return ret_value
