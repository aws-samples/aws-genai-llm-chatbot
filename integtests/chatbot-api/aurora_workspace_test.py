import json
import time
import uuid
import pytest
from clients.appsync_client import AppSyncClient


@pytest.fixture(scope="module", autouse=True)
def run_before_and_after_tests(client: AppSyncClient):
    for workspace in client.list_workspaces():
        if (
            workspace.get("name") == "INTEG_TEST_AURORA"
            or workspace.get("name") == "INTEG_TEST_AURORA_WITHOUT_RERANK"
        ) and workspace.get("status") == "ready":
            client.delete_workspace(workspace.get("id"))


def test_create(client: AppSyncClient, default_embed_model):
    rag_engines = client.list_rag_engines()
    engine = next(i for i in rag_engines if i.get("id") == "aurora")
    pytest.skip_flag = False
    if engine.get("enabled") == False:
        pytest.skip_flag = True
        pytest.skip("Aurora is not enabled.")
    input = {
        "kind": "auro2",
        "name": "INTEG_TEST_AURORA_WITHOUT_RERANK",
        "embeddingsModelProvider": "bedrock",
        "embeddingsModelName": default_embed_model,
        "languages": ["english"],
        "index": True,
        "hybridSearch": True,
        "metric": "inner",
        "chunkingStrategy": "recursive",
        "chunkSize": 1000,
        "chunkOverlap": 200,
    }
    input_with_rerank = input.copy()
    input_with_rerank["name"] = "INTEG_TEST_AURORA"
    input_with_rerank["crossEncoderModelName"] = "cross-encoder/ms-marco-MiniLM-L-12-v2"
    input_with_rerank["crossEncoderModelProvider"] = "sagemaker"
    pytest.workspace = client.create_aurora_workspace(input=input_with_rerank)
    pytest.workspace_no_re_rank = client.create_aurora_workspace(input=input)

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


def test_add_rss(client: AppSyncClient):
    if pytest.skip_flag == True:
        pytest.skip("Aurora is not enabled.")

    pytest.document = client.add_rss_feed(
        input={
            "workspaceId": pytest.workspace.get("id"),
            "title": "INTEG_TEST_AURORA_TITLE",
            "address": "https://github.com/aws-samples/aws-genai-llm-chatbot/"
            + "releases.atom",
            "contentTypes": ["text/html"],
            "followLinks": True,
            "limit": 2,
        }
    )
    client.add_rss_feed(
        input={
            "workspaceId": pytest.workspace_no_re_rank.get("id"),
            "title": "INTEG_TEST_AURORA_TITLE",
            "address": "https://github.com/aws-samples/aws-genai-llm-chatbot/"
            + "releases.atom",
            "contentTypes": ["text/html"],
            "followLinks": True,
            "limit": 2,
        }
    )

    ready = False
    retries = 0
    while not ready and retries < 20:
        time.sleep(5)
        retries += 1
        document = client.get_document(
            {
                "workspaceId": pytest.workspace.get("id"),
                "documentId": pytest.document.get("documentId"),
            }
        )
        if document.get("status") == "enabled":
            ready = True
            break
    assert document.get("id") == pytest.document.get("documentId")
    assert document.get("workspaceId") == pytest.workspace.get("id")
    assert ready == True

    # Wait for at least one each post to be processed
    ready = False
    retries = 0
    while not ready and retries < 10:
        time.sleep(60)
        retries += 1
        posts = client.get_rss_posts(
            {
                "workspaceId": pytest.workspace.get("id"),
                "documentId": pytest.document.get("documentId"),
            }
        )
        if len(posts.get("items")) > 0:
            ready = False
            for item in posts.get("items"):
                if item.get("status") == "processed":
                    ready = True
    assert ready == True


def test_search_document(client: AppSyncClient):
    if pytest.skip_flag == True:
        pytest.skip("Aurora is not enabled.")
    ready = False
    retries = 0
    # Wait for the page to be crawled. This starts on a cron every 5 min.
    while not ready and retries < 50:
        time.sleep(15)
        retries += 1
        result = client.semantic_search(
            input={
                "workspaceId": pytest.workspace.get("id"),
                "query": "Release github",
            }
        )
        if len(result.get("items")) > 1:
            ready = True
            assert result.get("engine") == "aurora"
            # Should return one of the proejct release page.
            assert result.get("items")[0].get("score") > 2
            assert (
                "https://github.com/aws-samples/aws-genai-llm-chatbot/releases"
                in result.get("items")[0].get("path")
            )
            assert "aws-samples/aws-genai-llm-chatbot" in result.get("items")[0].get(
                "content"
            )
            assert "website" in result.get("items")[0].get("documentType")
    assert ready == True


def test_search_document_no_reank(client: AppSyncClient):
    if pytest.skip_flag == True:
        pytest.skip("Aurora is not enabled.")
    ready = False
    retries = 0
    # Wait for the page to be crawled. This starts on a cron every 5 min.
    while not ready and retries < 50:
        time.sleep(15)
        retries += 1
        result = client.semantic_search(
            input={
                "workspaceId": pytest.workspace_no_re_rank.get("id"),
                "query": "Release github",
            }
        )
        if len(result.get("items")) > 1:
            ready = True
            assert result.get("engine") == "aurora"
            # Re-ranking score is no set but the results are ordered by Aurora.
            assert result.get("items")[0].get("score") is None
    assert ready == True


def test_query_llm(client, default_model, default_provider):
    if pytest.skip_flag == True:
        pytest.skip("Aurora is not enabled.")
    session_id = str(uuid.uuid4())
    request = {
        "action": "run",
        "modelInterface": "langchain",
        "data": {
            "mode": "chain",
            "text": "What github project is being released?",
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

        if session != None and len(session.get("history")) == 2:
            metadata = json.loads(str(session.get("history")[1].get("metadata")))
            found = len(metadata.get("documents")) > 0
            break
    client.delete_session(session_id)
    assert found == True


def test_delete_document(client: AppSyncClient):
    if pytest.skip_flag == True:
        pytest.skip("Aurora is not enabled.")
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
        pytest.skip("Aurora is not enabled.")
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
