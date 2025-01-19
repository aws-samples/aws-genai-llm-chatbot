import json
import uuid
import pytest
from gql.transport.exceptions import TransportQueryError
from clients.appsync_client import AppSyncClient


def test_unauthorized_with_annotation(client_user: AppSyncClient):
    # verifies that users without "admin" or "workspace_manager" role
    # cannot access the APIs
    # @aws_cognito_user_pools(cognito_groups: ["admin", "workspace_manager"])

    match = "Unauthorized"

    with pytest.raises(TransportQueryError, match="Something went wrong"):
        client_user.delete_session("id")
    with pytest.raises(TransportQueryError, match=match):
        client_user.list_models()
    with pytest.raises(TransportQueryError, match=match):
        client_user.list_rag_engines()
    with pytest.raises(TransportQueryError, match=match):
        client_user.create_aurora_workspace(
            input={
                "kind": "aoss",
                "name": "INTEG_TEST_OPEN_SEARCH",
                "embeddingsModelProvider": "bedrock",
                "embeddingsModelName": "model",
                "crossEncoderModelName": "cross-encoder/ms-marco-MiniLM-L-12-v2",
                "crossEncoderModelProvider": "sagemaker",
                "languages": ["english"],
                "index": True,
                "hybridSearch": False,
                "chunkingStrategy": "recursive",
                "chunkSize": 1000,
                "chunkOverlap": 200,
                "metric": "value",
            }
        )
    with pytest.raises(TransportQueryError, match=match):
        client_user.list_workspaces()
    with pytest.raises(TransportQueryError, match=match):
        client_user.get_workspace("id")
    with pytest.raises(TransportQueryError, match=match):
        client_user.delete_workspace("id")
    with pytest.raises(TransportQueryError, match=match):
        client_user.add_text(
            input={
                "workspaceId": "id",
                "title": "INTEG_TEST_OPEN_SEARCH_TITLE",
                "content": "The Integ Test flower is green.",
            }
        )
    with pytest.raises(TransportQueryError, match=match):
        client_user.add_rss_feed(
            input={
                "workspaceId": "id",
                "title": "INTEG_TEST_OPEN_SEARCH_TITLE",
                "content": "The Integ Test flower is green.",
                "address": "address",
                "limit": 1,
                "followLinks": True,
                "contentTypes": ["type"],
            }
        )
    with pytest.raises(TransportQueryError, match=match):
        client_user.get_document(
            input={
                "workspaceId": "id",
                "documentId": "id",
            }
        )
    with pytest.raises(TransportQueryError, match=match):
        client_user.get_rss_posts(
            input={
                "workspaceId": "id",
                "documentId": "id",
            }
        )
    with pytest.raises(TransportQueryError, match=match):
        client_user.semantic_search(input={"workspaceId": "id", "query": ""})
    with pytest.raises(TransportQueryError, match=match):
        client_user.delete_document(
            input={
                "workspaceId": "id",
                "documentId": "id",
            }
        )
    with pytest.raises(TransportQueryError, match=match):
        client_user.calculate_embeding(
            input={
                "model": "id",
                "provider": "id",
                "task": "store",
                "passages": [],
            }
        )
    with pytest.raises(TransportQueryError, match=match):
        client_user.rank_passages(
            input={
                "model": "cross-encoder/ms-marco-MiniLM-L-12-v2",
                "provider": "sagemaker",
                "reference": "What is a cat?",
                "passages": ["A cat is an animal.", "A car is a vehicle."],
            }
        )

    with pytest.raises(TransportQueryError, match=match):
        client_user.create_opensearch_workspace(
            input={
                "kind": "aoss",
                "name": "INTEG_TEST_OPEN_SEARCH",
                "embeddingsModelProvider": "bedrock",
                "embeddingsModelName": "model",
                "crossEncoderModelName": "cross-encoder/ms-marco-MiniLM-L-12-v2",
                "crossEncoderModelProvider": "sagemaker",
                "languages": ["english"],
                "index": True,
                "hybridSearch": False,
                "chunkingStrategy": "recursive",
                "chunkSize": 1000,
                "chunkOverlap": 200,
            }
        )
    with pytest.raises(TransportQueryError, match=match):
        client_user.start_kendra_data_sync("id")
    with pytest.raises(TransportQueryError, match=match):
        client_user.is_kendra_data_synching("id")
    with pytest.raises(TransportQueryError, match="File does not exist"):
        client_user.get_file_url("file")
    with pytest.raises(TransportQueryError, match=match):
        client_user.list_kendra_indexes()
    with pytest.raises(TransportQueryError, match=match):
        client_user.list_documents(
            input={
                "workspaceId": "id",
                "documentType": "file",
            }
        )
    with pytest.raises(TransportQueryError, match=match):
        client_user.create_kendra_workspace(
            input={
                "name": "workspace1",
                "kind": "kendra",
                "kendraIndexId": "kendra-id-1",
                "useAllData": True,
            }
        )
    with pytest.raises(TransportQueryError, match=match):
        client_user.list_roles()
    with pytest.raises(TransportQueryError, match=match):
        client_user.create_application(
            input={
                "id": "id",
                "name": "name",
                "model": "provider::model",
                "workspace": "workspace_name::workspace_id",
                "roles": [],
                "allowImageInput": True,
                "allowVideoInput": True,
                "allowDocumentInput": True,
                "enableGuardrails": False,
                "streaming": False,
                "maxTokens": 512,
                "temperature": 0.6,
                "topP": 0.9,
            }
        )
    with pytest.raises(TransportQueryError, match=match):
        client_user.update_application(
            input={
                "id": "id",
                "name": "name",
                "model": "provider::model",
                "workspace": "workspace_name::workspace_id",
                "roles": [],
                "allowImageInput": True,
                "allowVideoInput": True,
                "allowDocumentInput": True,
                "enableGuardrails": False,
                "streaming": False,
                "maxTokens": 512,
                "temperature": 0.6,
                "topP": 0.9,
            }
        )


def test_unauthorized_with_method(
    client_user: AppSyncClient, client: AppSyncClient, default_model, default_provider
):
    # verifies that users without "admin" or "workspace_manager" role
    # cannot access the APIs

    delete_sessions_result = client_user.delete_user_sessions()
    assert delete_sessions_result is not None

    session_id = str(uuid.uuid4())
    workspace_id = str(uuid.uuid4())
    request = {
        "action": "run",
        "modelInterface": "langchain",
        "data": {
            "mode": "chain",
            "text": "What github project is being released?",
            "images": [],
            "videos": [],
            "documents": [],
            "modelName": default_model,
            "provider": default_provider,
            "workspaceId": workspace_id,
            "sessionId": session_id,
            "modelKwargs": {"temperature": 0},
        },
    }

    with pytest.raises(
        TransportQueryError, match="User is not authorized to access this application"
    ):
        client_user.send_query(json.dumps(request))

    session = client_user.get_session("id")
    assert session is None

    sessions = client_user.list_sessions()
    assert len(sessions) == 0

    with pytest.raises(TransportQueryError, match="File does not exist"):
        client_user.get_file_url("file")

    with pytest.raises(TransportQueryError, match="Unauthorized"):
        client_user.add_file(
            input={
                "workspaceId": "id",
                "fileName": "file.txt",
            }
        )

    all_applications = client.list_applications()
    user_applications_count = 0
    for app in all_applications:
        if "user" in app.get("roles"):
            user_applications_count = user_applications_count + 1
    applications = client_user.list_applications()

    assert len(applications) == user_applications_count
    for app in applications:
        assert app.get("roles") is None
        assert app.get("systemPrompt") is None

    app = client_user.get_application("id")
    assert app is None
