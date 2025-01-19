from pydantic import ValidationError
import pytest
from genai_core.types import CommonError
from routes.documents import file_upload
from routes.documents import get_documents
from routes.documents import delete_document
from routes.documents import get_document_details
from routes.documents import get_rss_posts
from routes.documents import enable_document
from routes.documents import add_text_document
from routes.documents import add_qna_document
from routes.documents import add_website
from routes.documents import add_rss_feed
from routes.documents import update_rss_feed


document = {
    "format_version": 1,
    "workspace_id": "workspace_id",
    "document_id": "document_id",
    "document_type": "document_type",
    "document_sub_type": "document_sub_type",
    "sub_documents": None,
    "compound_sort_key": None,
    "status": "submitted",
    "title": "title",
    "path": "path",
    "size_in_bytes": 1,
    "vectors": 0,
    "errors": [],
    "created_at": 1,
    "updated_at": 1,
}


def test_file_upload(mocker):
    mocker.patch(
        "genai_core.presign.generate_workspace_presigned_post", return_value="url"
    )
    mocker.patch("genai_core.presign.generate_user_presigned_post", return_value="url")
    mocker.patch("genai_core.auth.get_user_id", return_value="id")
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user"])
    assert file_upload({"fileName": "fileName.txt"}) == "url"

    mocker.patch("genai_core.auth.get_user_roles", return_value=["admin"])
    assert file_upload({"fileName": "fileName.txt", "workspaceId": "id"}) == "url"

    mocker.patch("genai_core.auth.get_user_roles", return_value=["workspace_manager"])
    assert file_upload({"fileName": "fileName.txt", "workspaceId": "id"}) == "url"


def test_file_upload_without_admin_role(mocker):
    mocker.patch(
        "genai_core.presign.generate_workspace_presigned_post", return_value="url"
    )
    mocker.patch("genai_core.auth.get_user_roles", return_value=[])
    with pytest.raises(CommonError, match="Unauthorized"):
        assert file_upload({"fileName": "fileName.txt", "workspaceId": "id"})
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user"])
    with pytest.raises(CommonError, match="Unauthorized"):
        assert file_upload({"fileName": "fileName.txt", "workspaceId": "id"})


def test_file_upload_invalid_input(mocker):
    with pytest.raises(ValidationError, match="1 validation error"):
        file_upload({})
    with pytest.raises(ValidationError, match="2 validation errors"):
        file_upload({"fileName": "fileName<txt", "workspaceId": "id<"})
    with pytest.raises(ValidationError, match="2 validation errors"):
        file_upload({"fileName": "", "workspaceId": ""})


def test_file_upload_with_invalid_extension(mocker):
    mocker.patch("genai_core.auth.get_user_roles", return_value=["admin"])
    with pytest.raises(CommonError, match="Invalid file extension"):
        file_upload({"fileName": "fileName.abc", "workspaceId": "id"})


def test_get_documents(mocker):
    mocker.patch(
        "genai_core.documents.list_documents",
        return_value={
            "last_document_id": document.get("document_id"),
            "items": [document],
        },
    )
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])
    response = get_documents({"documentType": "type", "workspaceId": "id"})
    assert response.get("lastDocumentId") == document.get("document_id")
    assert len(response.get("items")) == 1


def test_get_documents_unauthorized(mocker):
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user"])
    response = get_documents({"documentType": "type", "workspaceId": "id"})
    assert response.get("error") == "Unauthorized"


def test_get_documents_invalid_input(mocker):
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])
    with pytest.raises(ValidationError, match="2 validation errors"):
        get_documents({})
    with pytest.raises(ValidationError, match="1 validation error"):
        get_documents({"documentType": "type", "workspaceId": "<id"})
    with pytest.raises(ValidationError, match="1 validation error"):
        get_documents({"documentType": "<type", "workspaceId": "id"})
    with pytest.raises(ValidationError, match="2 validation errors"):
        get_documents({"documentType": "", "workspaceId": "", "lastDocumentId": "id"})
    with pytest.raises(ValidationError, match="1 validation error"):
        get_documents(
            {"documentType": "type", "workspaceId": "id", "lastDocumentId": "<"}
        )
    with pytest.raises(ValidationError, match="1 validation error"):
        get_documents(
            {"documentType": "type", "workspaceId": "id", "lastDocumentId": ""}
        )


def test_delete_document(mocker):
    mocker.patch(
        "genai_core.documents.delete_document",
        return_value={"documentId": document.get("document_id"), "deleted": True},
    )
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])
    response = delete_document({"documentId": "id", "workspaceId": "id"})
    assert response.get("deleted") == True


def test_delete_document_unauthorized(mocker):
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user"])
    response = delete_document({"documentId": "id", "workspaceId": "id"})
    assert response.get("error") == "Unauthorized"


def test_delete_document_invalid_input(mocker):
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])
    with pytest.raises(ValidationError, match="2 validation errors"):
        delete_document({})
    with pytest.raises(ValidationError, match="1 validation error"):
        delete_document({"documentId": "id", "workspaceId": "<id"})
    with pytest.raises(ValidationError, match="1 validation error"):
        delete_document({"documentId": "<id", "workspaceId": "id"})


def test_get_document_details(mocker):
    mocker.patch("genai_core.documents.get_document", return_value=document)
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])
    response = get_document_details({"documentId": "id", "workspaceId": "id"})
    assert response.get("id") == document.get("document_id")


def test_get_document_details_unauthorized(mocker):
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user"])
    response = get_document_details({"documentId": "id", "workspaceId": "id"})
    assert response.get("error") == "Unauthorized"


def test_get_document_invalid_input(mocker):
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])
    with pytest.raises(ValidationError, match="2 validation errors"):
        get_document_details({})
    with pytest.raises(ValidationError, match="1 validation error"):
        get_document_details({"documentId": "id", "workspaceId": "<id"})
    with pytest.raises(ValidationError, match="1 validation error"):
        get_document_details({"documentId": "<id", "workspaceId": "id"})


def test_get_rss_posts(mocker):
    mocker.patch(
        "genai_core.documents.list_documents",
        return_value={
            "last_document_id": document.get("document_id"),
            "items": [document],
        },
    )
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])
    response = get_rss_posts({"documentId": "id", "workspaceId": "id"})
    assert response.get("lastDocumentId") == document.get("document_id")
    assert len(response.get("items")) == 1


def test_get_rss_posts_unauthorized(mocker):
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user"])
    response = get_rss_posts({"documentId": "id", "workspaceId": "id"})
    assert response.get("error") == "Unauthorized"


def test_get_rss_posts_invalid_input(mocker):
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])
    with pytest.raises(ValidationError, match="3 validation errors"):
        get_rss_posts({"documentId": "<", "workspaceId": "<", "lastDocumentId": "<"})
    with pytest.raises(ValidationError, match="2 validation errors"):
        get_rss_posts({"documentId": "", "workspaceId": ""})


def test_enable_document_enabled(mocker):
    mock = mocker.patch("genai_core.documents.enable_document_subscription")
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])
    enable_document({"documentId": "id", "workspaceId": "id", "status": "enabled"})
    assert mock.call_count == 1


def test_enable_document_disabled(mocker):
    mock = mocker.patch("genai_core.documents.disable_document_subscription")
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])
    enable_document({"documentId": "id", "workspaceId": "id", "status": "disabled"})
    assert mock.call_count == 1


def test_enable_document_unauthorized(mocker):
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user"])
    response = enable_document(
        {"documentId": "id", "workspaceId": "id", "status": "enabled"}
    )
    assert response.get("error") == "Unauthorized"


def test_enable_document_invalid_status(mocker):
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])
    with pytest.raises(CommonError):
        enable_document({"documentId": "id", "workspaceId": "id", "status": "invalid"})


def test_enable_document_invalid_input(mocker):
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])
    with pytest.raises(ValidationError, match="3 validation errors"):
        enable_document({"documentId": "<", "workspaceId": "<", "status": "<"})
    with pytest.raises(ValidationError, match="2 validation errors"):
        enable_document({"documentId": "", "workspaceId": ""})


def test_add_text_document(mocker):
    mock = mocker.patch("genai_core.documents.create_document", return_value=document)
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])
    input = {"content": "content", "workspaceId": "id", "title": "title"}
    response = add_text_document(input)
    mock.assert_called_once_with(
        workspace_id=input.get("workspaceId"),
        document_type="text",
        title=input.get("title"),
        content=input.get("content"),
    )
    assert response.get("documentId") == document.get("document_id")


def test_add_text_document_unauthorized(mocker):
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user"])
    input = {"content": "content", "workspaceId": "id", "title": "title"}
    response = add_text_document(input)
    assert response.get("error") == "Unauthorized"


def test_add_text_document_invalid_input(mocker):
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])
    with pytest.raises(ValidationError, match="3 validation errors"):
        add_text_document({"content": "", "workspaceId": "", "title": ""})
    with pytest.raises(ValidationError, match="2 validation errors"):
        add_text_document({"content": "content", "workspaceId": "<", "title": "<"})


def test_add_qna_document(mocker):
    mock = mocker.patch("genai_core.documents.create_document", return_value=document)
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])
    input = {"question": "question", "workspaceId": "id", "answer": "answer"}
    response = add_qna_document(input)
    mock.assert_called_once_with(
        workspace_id=input.get("workspaceId"),
        document_type="qna",
        title=input.get("question"),
        content=input.get("question"),
        content_complement=input.get("answer"),
    )
    assert response.get("documentId") == document.get("document_id")


def test_add_qna_document_unauthorized(mocker):
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user"])
    input = {"question": "question", "workspaceId": "id", "answer": "answer"}
    response = add_qna_document(input)
    assert response.get("error") == "Unauthorized"


def test_add_qna_document_invalid_input(mocker):
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])
    with pytest.raises(ValidationError, match="3 validation errors"):
        add_qna_document({"question": "", "workspaceId": "", "answer": ""})
    with pytest.raises(ValidationError, match="1 validation error"):
        add_qna_document({"question": "<", "workspaceId": "<", "answer": "<"})


def test_add_website(mocker):
    mock = mocker.patch("genai_core.documents.create_document", return_value=document)
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])
    input = {
        "sitemap": True,
        "workspaceId": "id",
        "address": "https://amazon.com",
        "followLinks": False,
        "limit": 90000,
        "contentTypes": [],
    }
    response = add_website(input)
    mock.assert_called_once_with(
        workspace_id=input.get("workspaceId"),
        document_type="website",
        document_sub_type="sitemap",
        path="https://amazon.com/",
        crawler_properties={
            "follow_links": input.get("followLinks"),
            "limit": 1000,
            "content_types": input.get("contentTypes"),
        },
    )
    assert response.get("documentId") == document.get("document_id")


def test_add_website_unauthorized(mocker):
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user"])
    input = {
        "sitemap": True,
        "workspaceId": "id",
        "address": "https://address.",
        "followLinks": False,
        "limit": 90000,
        "contentTypes": [],
    }
    response = add_website(input)
    assert response.get("error") == "Unauthorized"


def test_add_website_invalid_input(mocker):
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])
    with pytest.raises(ValidationError, match="5 validation errors"):
        add_website({})
    with pytest.raises(ValidationError, match="6 validation errors"):
        add_website(
            {
                "sitemap": "WrongType",
                "workspaceId": "<",
                "address": ">notAUrl",
                "followLinks": "WrongType",
                "limit": -1,
                "contentTypes": [""],
            }
        )
    with pytest.raises(ValidationError, match="Input should be a valid URL"):
        add_website(
            {
                "sitemap": True,
                "workspaceId": "id",
                "address": "https//amazon.com",
                "followLinks": False,
                "limit": 90000,
                "contentTypes": [],
            }
        )
    with pytest.raises(
        ValidationError, match="URL should have at most 2083 characters"
    ):
        add_website(
            {
                "sitemap": True,
                "workspaceId": "id",
                "address": "https://amazon.com/" + "A" * 5000,
                "followLinks": False,
                "limit": 90000,
                "contentTypes": [],
            }
        )
    with pytest.raises(CommonError, match="URLs containing IPs are not allowed"):
        add_website(
            {
                "sitemap": True,
                "workspaceId": "id",
                "address": "https://127.0.0.1",
                "followLinks": False,
                "limit": 90000,
                "contentTypes": [],
            }
        )
    with pytest.raises(CommonError, match="Invalid URL"):
        add_website(
            {
                "sitemap": True,
                "workspaceId": "id",
                "address": "https://localhost",
                "followLinks": False,
                "limit": 90000,
                "contentTypes": [],
            }
        )

    with pytest.raises(
        ValidationError,
        match="List should have at most 10 items after validation, not 12",
    ):
        add_website(
            {
                "sitemap": True,
                "workspaceId": "id",
                "address": "https://amazon.com/",
                "followLinks": False,
                "limit": 90000,
                "contentTypes": [
                    "too",
                    "many",
                    "items",
                    "too",
                    "many",
                    "items",
                    "too",
                    "many",
                    "items",
                    "too",
                    "many",
                    "items",
                ],
            }
        )


def test_add_rss_feed(mocker):
    mock = mocker.patch("genai_core.documents.create_document", return_value=document)
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])
    input = {
        "workspaceId": "id",
        "address": "https://amazon.com",
        "title": "title",
        "followLinks": False,
        "limit": 90000,
        "contentTypes": [],
    }
    response = add_rss_feed(input)
    mock.assert_called_once_with(
        workspace_id=input.get("workspaceId"),
        document_type="rssfeed",
        path="https://amazon.com/",
        title=input.get("title"),
        crawler_properties={
            "follow_links": input.get("followLinks"),
            "limit": 1000,
            "content_types": input.get("contentTypes"),
        },
    )
    assert response.get("documentId") == document.get("document_id")


def test_add_rss_feed_unauthorized(mocker):
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user"])
    input = {
        "workspaceId": "id",
        "address": "path",
        "title": "title",
        "followLinks": False,
        "limit": 90000,
        "contentTypes": [],
    }
    response = add_rss_feed(input)
    assert response.get("error") == "Unauthorized"


def test_add_rss_feed_invalid_input(mocker):
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])
    with pytest.raises(ValidationError, match="3 validation errors"):
        add_rss_feed({})
    with pytest.raises(ValidationError, match="5 validation errors"):
        add_rss_feed(
            {
                "workspaceId": "<",
                "address": ">notAUrl",
                "followLinks": "WrongType",
                "limit": -1,
                "contentTypes": [""],
            }
        )
    with pytest.raises(ValidationError, match="3 validation errors"):
        add_rss_feed(
            {
                "sitemap": True,
                "workspaceId": "",
                "address": "",
                "followLinks": True,
                "limit": 1,
                "contentTypes": ["<"],
            }
        )
    with pytest.raises(CommonError, match="address is not set"):
        add_rss_feed(
            {
                "workspaceId": "id",
                "title": "title",
                "followLinks": False,
                "limit": 90000,
                "contentTypes": [],
            }
        )
    with pytest.raises(ValidationError, match="Input should be a valid URL"):
        add_rss_feed(
            {
                "workspaceId": "id",
                "address": "https//amazon.com",
                "title": "title",
                "followLinks": False,
                "limit": 90000,
                "contentTypes": [],
            }
        )
    with pytest.raises(
        ValidationError, match="URL should have at most 2083 characters"
    ):
        add_rss_feed(
            {
                "sitemap": True,
                "workspaceId": "id",
                "address": "https://amazon.com/" + "A" * 5000,
                "followLinks": False,
                "limit": 90000,
                "contentTypes": [],
            }
        )
    with pytest.raises(CommonError, match="URLs containing IPs are not allowed"):
        add_rss_feed(
            {
                "sitemap": True,
                "workspaceId": "id",
                "address": "https://127.0.0.1",
                "followLinks": False,
                "limit": 90000,
                "contentTypes": [],
            }
        )
    with pytest.raises(CommonError, match="Invalid URL"):
        add_rss_feed(
            {
                "sitemap": True,
                "workspaceId": "id",
                "address": "https://localhost",
                "followLinks": False,
                "limit": 90000,
                "contentTypes": [],
            }
        )
    with pytest.raises(
        ValidationError,
        match="List should have at most 10 items after validation, not 12",
    ):
        add_rss_feed(
            {
                "sitemap": True,
                "workspaceId": "id",
                "address": "https://amaonz.com",
                "followLinks": False,
                "limit": 90000,
                "contentTypes": [
                    "too",
                    "many",
                    "items",
                    "too",
                    "many",
                    "items",
                    "too",
                    "many",
                    "items",
                    "too",
                    "many",
                    "items",
                ],
            }
        )


def test_update_rss_feed(mocker):
    mock = mocker.patch("genai_core.documents.update_document", return_value=document)
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])
    input = {
        "workspaceId": "id",
        "documentId": document.get("document_id"),
        "followLinks": False,
        "limit": 50,
        "contentTypes": [],
    }
    response = update_rss_feed(input)
    mock.assert_called_once_with(
        workspace_id=input.get("workspaceId"),
        document_type="rssfeed",
        document_id=input.get("documentId"),
        follow_links=input.get("followLinks"),
        limit=input.get("limit"),
        content_types=input.get("contentTypes"),
    )
    assert response.get("documentId") == document.get("document_id")
    assert response.get("status") == "updated"


def test_update_rss_feed_unauthorized(mocker):
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user"])
    input = {
        "workspaceId": "id",
        "documentId": "documentId",
        "address": "path",
        "title": "title",
        "followLinks": False,
        "limit": 1000,
        "contentTypes": [],
    }
    response = update_rss_feed(input)
    assert response.get("error") == "Unauthorized"


def test_update_rss_feed_invalid_input(mocker):
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])
    with pytest.raises(ValidationError, match="4 validation errors"):
        update_rss_feed({})
    with pytest.raises(ValidationError, match="1 validation error"):
        update_rss_feed(
            {
                "workspaceId": "id",
                "title": "title",
                "followLinks": False,
                "limit": 50,
                "contentTypes": [],
            }
        )
    with pytest.raises(
        ValidationError,
        match="List should have at most 10 items after validation, not 12",
    ):
        update_rss_feed(
            {
                "workspaceId": "id",
                "documentId": "id",
                "title": "title",
                "followLinks": False,
                "limit": 50,
                "contentTypes": [
                    "too",
                    "many",
                    "items",
                    "too",
                    "many",
                    "items",
                    "too",
                    "many",
                    "items",
                    "too",
                    "many",
                    "items",
                ],
            }
        )
