from pydantic import ValidationError
import pytest
from routes.semantic_search import semantic_search


def test_semantic_search(mocker):
    dummy_item = {
        "sources": ["source"],
        "chunk_id": "chunk_id",
        "document_id": "document_id",
        "workspace_id": "workspace_id",
        "document_sub_id": "document_sub_id",
        "document_type": "document_type",
        "document_sub_type": "document_sub_type",
        "document_sub_type": "document_sub_type",
        "path": "path",
        "language": "language",
        "title": "title",
        "content": "content",
        "content_complement": "content_complement",
        "vector_search_score": 1,
        "keyword_search_score": 1,
        "score": 1,
    }

    search_response = {
        "engine": "opensearch",
        "supported_languages": ["en"],
        "items": [dummy_item.copy()],
        "vector_search_metric": "l2",
        "vector_search_items": [dummy_item.copy()],
        "keyword_search_items": [dummy_item.copy()],
    }
    mock = mocker.patch(
        "genai_core.semantic_search.semantic_search", return_value=search_response
    )
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])
    input = {"query": "query", "workspaceId": "id"}
    response = semantic_search(input)
    mock.assert_called_once_with(
        workspace_id=input.get("workspaceId"),
        limit=25,
        query=input.get("query"),
        full_response=True,
    )

    assert response.get("engine") == search_response.get("engine")
    assert response.get("workspaceId") == "id"
    assert response.get("supportedLanguages") == search_response.get(
        "supported_languages"
    )
    assert response.get("vectorSearchMetric") == search_response.get(
        "vector_search_metric"
    )
    assert len(response.get("items")) == 1
    assert len(response.get("vectorSearchItems")) == 1
    assert len(response.get("keywordSearchItems")) == 1


def test_semantic_search_invalid_input(mocker):
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])
    with pytest.raises(ValidationError, match="2 validation error"):
        semantic_search({})
    with pytest.raises(ValidationError, match="2 validation error"):
        semantic_search({"query": "<", "workspaceId": "<"})
    with pytest.raises(ValidationError, match="2 validation error"):
        semantic_search({"query": "<", "workspaceId": "<"})


def test_semantic_search_unauthorized(mocker):
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user"])
    response = semantic_search({})
    assert response.get("error") == "Unauthorized"
