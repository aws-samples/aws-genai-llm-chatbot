import json
import time
import uuid
import pytest
from clients.appsync_client import AppSyncClient


@pytest.fixture(scope="module", autouse=True)
def run_before_and_after_tests(client: AppSyncClient):
    for workspace in client.list_workspaces():
        if (
            workspace.get("name") == "INTEG_TEST_OPEN_SEARCH"
            and workspace.get("status") == "ready"
        ):
            client.delete_workspace(workspace.get("id"))


def test_create(client: AppSyncClient, default_embed_model):
    rag_engines = client.list_rag_engines()
    engine = next(i for i in rag_engines if i.get("id") == "opensearch")
    pytest.skip_flag = False
    if engine.get("enabled") == False:
        pytest.skip_flag = True
        pytest.skip("Open search is not enabled.")
    pytest.workspace = client.create_opensearch_workspace(
        input={
            "kind": "aoss",
            "name": "INTEG_TEST_OPEN_SEARCH",
            "embeddingsModelProvider": "bedrock",
            "embeddingsModelName": default_embed_model,
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

    ready = False
    retries = 0
    # Wait for step function execution to complete and create the index
    while not ready and retries < 10:
        time.sleep(1)
        retries += 1
        workspace = client.get_workspace(pytest.workspace.get("id"))
        if workspace.get("status") == "ready":
            ready = True
            break
    assert ready == True


def test_add_text(client: AppSyncClient):
    if pytest.skip_flag == True:
        pytest.skip("Open search is not enabled.")
    pytest.document = client.add_text(
        input={
            "workspaceId": pytest.workspace.get("id"),
            "title": "INTEG_TEST_OPEN_SEARCH_TITLE",
            "content": "The Integ Test flower is green.",
        }
    )
    # This test can take several minutes because it's waiting for
    # AWSBatch to start a host
    ready = False
    retries = 0
    while not ready and retries < 50:
        time.sleep(15)
        retries += 1
        document = client.get_document(
            {
                "workspaceId": pytest.workspace.get("id"),
                "documentId": pytest.document.get("documentId"),
            }
        )
        if document.get("status") == "processed":
            ready = True
            break
    assert document.get("id") == pytest.document.get("documentId")
    assert document.get("workspaceId") == pytest.workspace.get("id")
    assert ready == True


def test_search_document(client: AppSyncClient):
    if pytest.skip_flag == True:
        pytest.skip("Open search is not enabled.")
    ready = False
    retries = 0
    # wait for the open search index update
    while not ready and retries < 50:
        time.sleep(15)
        retries += 1
        result = client.semantic_search(
            input={
                "workspaceId": pytest.workspace.get("id"),
                "query": "INTEG",
            }
        )
        if len(result.get("items")) == 1:
            ready = True
            assert result.get("engine") == "opensearch"
            assert result.get("items")[0].get("documentId") == pytest.document.get(
                "documentId"
            )
    assert ready == True


def test_query_llm(client, default_model, default_provider):
    if pytest.skip_flag == True:
        pytest.skip("Open search is not enabled.")
    session_id = str(uuid.uuid4())
    request = {
        "action": "run",
        "modelInterface": "langchain",
        "data": {
            "mode": "chain",
            "text": "What is the integ test flower color?",
            "files": [],
            "modelName": default_model,
            "provider": default_provider,
            "workspaceId": pytest.workspace.get("id"),
            "sessionId": session_id,
            "modelKwargs": {"temperature": 0},
        },
    }

    client.send_query(json.dumps(request))

    found = False
    retries = 0
    while not found and retries < 15:
        time.sleep(1)
        retries += 1
        session = client.get_session(session_id)
        if (
            session != None
            and len(session.get("history")) == 2
            and "green" in session.get("history")[1].get("content").lower()
        ):
            found = True
            break
    client.delete_session(session_id)
    assert found == True


def test_delete_document(client: AppSyncClient):
    if pytest.skip_flag == True:
        pytest.skip("Open search is not enabled.")
    client.delete_document(
        input={
            "workspaceId": pytest.workspace.get("id"),
            "documentId": pytest.document.get("documentId"),
        }
    )
    ready = False
    retries = 0
    # Wait for the removal (step function)
    while not ready and retries < 50:
        time.sleep(15)
        retries += 1
        document = client.get_document(
            {
                "workspaceId": pytest.workspace.get("id"),
                "documentId": pytest.document.get("documentId"),
            }
        )
        if document == None:
            ready = True
            break
    assert ready == True


def test_delete_workspace(client: AppSyncClient):
    if pytest.skip_flag == True:
        pytest.skip("Open search is not enabled.")
    client.delete_workspace(pytest.workspace.get("id"))
    # Wait for the removal (step function)
    ready = False
    retries = 0
    while not ready and retries < 50:
        time.sleep(15)
        retries += 1
        workspace = client.get_workspace(pytest.workspace.get("id"))
        if workspace == None:
            ready = True
            break
    assert ready == True
