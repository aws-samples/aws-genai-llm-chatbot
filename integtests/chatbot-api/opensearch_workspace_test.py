import time
import pytest
from clients.appsync_client import AppSyncClient

@pytest.fixture(scope="module", autouse=True)
def run_before_and_after_tests(client: AppSyncClient):
    rag_engines = client.list_rag_engines()
    engine = next(i for i in rag_engines if i.get("id") == "opensearch")
    if engine.get("enabled") == False:
        pytest.skip("Open search is not enabled.", allow_module_level=True)

    for workspace in client.list_workspaces():
        if (
            workspace.get("name") == "INTEG_TEST_OPEN_SEARCH"
            and workspace.get("status") == "ready"
        ):
            client.delete_workspace(workspace.get("id"))


def test_create(client: AppSyncClient, default_embed_model):
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
    pytest.document = client.add_text(
        input={
            "workspaceId": pytest.workspace.get("id"),
            "title": "INTEG_TEST_OPEN_SEARCH_TITLE",
            "content": "INTEG_TEST_OPEN_SERCH_CONTENT",
        }
    )
    # This test can take several minutes because it's waiting for AWSBatch to start a host
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
    ready = False
    retries = 0
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
            assert result.get("items")[0].get("content") == "INTEG_TEST_OPEN_SERCH_CONTENT"
            break
    assert ready == True
    
def test_delete_document(client: AppSyncClient):
    client.delete_document(
        input={
            "workspaceId": pytest.workspace.get("id"),
            "documentId": pytest.document.get("documentId"),
        }
    )
    # This test can take several minutes because it's waiting for AWSBatch to start a host
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
        if document == None:
            ready = True
            break
    assert ready == True
    
def test_delete_document(client: AppSyncClient):
    client.delete_workspace(pytest.workspace.get("id"))
    # This test can take several minutes because it's waiting for AWSBatch to start a host
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