from datetime import datetime
import json
import uuid
import pytest
from gql.transport.exceptions import TransportQueryError
from clients.appsync_client import AppSyncClient


def test_access_workspace_manager_role(
    client_workspace_manager: AppSyncClient, default_model, default_provider
):
    # the test verifies that user with workspace_manager role can access APIs

    session_id = str(uuid.uuid4())
    workspace_id = str(uuid.uuid4())
    request = {
        "action": "run",
        "modelInterface": "langchain",
        "data": {
            "mode": "chain",
            "text": "What github project is being released?",
            "files": [],
            "modelName": default_model,
            "provider": default_provider,
            "workspaceId": workspace_id,
            "sessionId": session_id,
            "modelKwargs": {"temperature": 0},
        },
    }

    send_query_result = client_workspace_manager.send_query(json.dumps(request))
    assert send_query_result is not None

    session = client_workspace_manager.get_session("id")
    assert session is None

    sessions = client_workspace_manager.list_sessions()
    assert len(sessions) == 0

    with pytest.raises(TransportQueryError, match="Something went wrong"):
        client_workspace_manager.delete_session("id")

    models = client_workspace_manager.list_models()
    assert len(models) > 0

    rags = client_workspace_manager.list_rag_engines()
    assert len(rags) > 0

    delete_sessions_result = client_workspace_manager.delete_user_sessions()
    assert delete_sessions_result is not None

    with pytest.raises(TransportQueryError, match="Embeddings model not found"):
        client_workspace_manager.create_aurora_workspace(
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

    workspaces = client_workspace_manager.list_workspaces()
    assert workspaces is not None

    workspace = client_workspace_manager.get_workspace("id")
    assert workspace is None

    with pytest.raises(TransportQueryError, match="Workspace not found"):
        client_workspace_manager.delete_workspace("id")
    with pytest.raises(TransportQueryError, match="Workspace not found"):
        client_workspace_manager.add_text(
            input={
                "workspaceId": "id",
                "title": "INTEG_TEST_OPEN_SEARCH_TITLE",
                "content": "The Integ Test flower is green.",
            }
        )
    with pytest.raises(TransportQueryError, match="Workspace not found"):
        client_workspace_manager.add_rss_feed(
            input={
                "workspaceId": "id",
                "title": "INTEG_TEST_OPEN_SEARCH_TITLE",
                "content": "The Integ Test flower is green.",
                "address": "https://www.amazon.com",
                "limit": 1,
                "followLinks": True,
                "contentTypes": ["type"],
            }
        )

    document = client_workspace_manager.get_document(
        input={
            "workspaceId": "id",
            "documentId": "id",
        }
    )
    assert document is None

    with pytest.raises(TransportQueryError, match="Workspace not found"):
        client_workspace_manager.get_rss_posts(
            input={
                "workspaceId": "id",
                "documentId": "id",
            }
        )
    with pytest.raises(TransportQueryError, match="Workspace not found"):
        client_workspace_manager.semantic_search(
            input={"workspaceId": "id", "query": ""}
        )
    with pytest.raises(TransportQueryError, match="Document not found"):
        client_workspace_manager.delete_document(
            input={
                "workspaceId": "id",
                "documentId": "id",
            }
        )
    with pytest.raises(TransportQueryError, match="Passages is empty"):
        client_workspace_manager.calculate_embeding(
            input={
                "model": "id",
                "provider": "id",
                "task": "store",
                "passages": [],
            }
        )

    ranked_passages = client_workspace_manager.rank_passages(
        input={
            "model": "cross-encoder/ms-marco-MiniLM-L-12-v2",
            "provider": "sagemaker",
            "reference": "What is a cat?",
            "passages": ["A cat is an animal.", "A car is a vehicle."],
        }
    )
    assert ranked_passages is not None

    with pytest.raises(TransportQueryError, match="Embeddings model not found"):
        client_workspace_manager.create_opensearch_workspace(
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
    with pytest.raises(TransportQueryError, match="Workspace id not found"):
        client_workspace_manager.start_kendra_data_sync("id")
    with pytest.raises(TransportQueryError, match="Workspace id not found"):
        client_workspace_manager.is_kendra_data_synching("id")
    with pytest.raises(TransportQueryError, match="File does not exist"):
        client_workspace_manager.get_file_url("file")

    kendra_indexes = client_workspace_manager.list_kendra_indexes()
    assert kendra_indexes is not None

    with pytest.raises(TransportQueryError, match="Workspace not found"):
        client_workspace_manager.list_documents(
            input={
                "workspaceId": "id",
                "documentType": "file",
            }
        )
    with pytest.raises(TransportQueryError, match="Workspace not found"):
        client_workspace_manager.add_file(
            input={
                "workspaceId": "id",
                "fileName": "file.txt",
            }
        )
    with pytest.raises(TransportQueryError, match="Kendra index not found"):
        client_workspace_manager.create_kendra_workspace(
            input={
                "name": "workspace1",
                "kind": "kendra",
                "kendraIndexId": "kendra-id-1",
                "useAllData": True,
            }
        )

    with pytest.raises(TransportQueryError, match="Unauthorized"):
        client_workspace_manager.list_roles()

    applications = client_workspace_manager.list_applications()
    assert applications is not None

    app = client_workspace_manager.get_application("id")
    assert app is None

    with pytest.raises(TransportQueryError, match="Unauthorized"):
        client_workspace_manager.create_application(
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
                "createTime": datetime.now().strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
            }
        )

    with pytest.raises(TransportQueryError, match="Unauthorized"):
        client_workspace_manager.update_application(
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
                "createTime": datetime.now().strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
            }
        )
