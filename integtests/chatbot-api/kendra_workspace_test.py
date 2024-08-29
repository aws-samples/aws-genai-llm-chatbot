import json
import time
import uuid
import pytest
import requests
from clients.appsync_client import AppSyncClient


@pytest.fixture(scope="module", autouse=True)
def run_before_and_after_tests(client: AppSyncClient):
    for workspace in client.list_workspaces():
        if (
            workspace.get("name") == "INTEG_TEST_KENDRA"
            and workspace.get("status") == "ready"
        ):
            client.delete_workspace(workspace.get("id"))


def test_create(client: AppSyncClient, default_embed_model):
    rag_engines = client.list_rag_engines()
    engine = next(i for i in rag_engines if i.get("id") == "kendra")
    pytest.skip_flag = False
    if engine.get("enabled") == False:
        pytest.skip_flag = True
        pytest.skip("Kendra is not enabled.")

    kendra_indexes = client.list_kendra_indexes()
    kendra_index_id = kendra_indexes[0].get("id")
    pytest.workspace = client.create_kendra_workspace(
        input={
            "kind": "kendra",
            "name": "INTEG_TEST_KENDRA",
            "kendraIndexId": kendra_index_id,
            "useAllData": False,
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


def test_add_file(client: AppSyncClient):
    if pytest.skip_flag == True:
        pytest.skip("Kendra is not enabled.")
    result = client.add_file(
        input={
            "workspaceId": pytest.workspace.get("id"),
            "fileName": "content.txt",
        }
    )

    fields = result.get("fields")
    cleaned_fields = fields.replace("{", "").replace("}", "")
    pairs = [pair.strip() for pair in cleaned_fields.split(",")]
    fields_dict = dict(pair.split("=", 1) for pair in pairs)
    files = {"file": b"The Integ Test flower is yellow."}
    response = requests.post(result.get("url"), data=fields_dict, files=files)
    assert response.status_code == 204

    # Document is added to kendra following a S3 Event processed by a lambda
    # Waiting (it takes <10 sec)
    retries = 0
    while retries < 30:
        time.sleep(1)
        retries += 1
        posts = client.list_documents(
            {"workspaceId": pytest.workspace.get("id"), "documentType": "file"}
        )
        if len(posts.get("items")) > 0:
            break

    client.start_kendra_data_sync(pytest.workspace.get("id"))

    syncInProgress = True
    syncRetries = 0
    while syncInProgress and syncRetries < 15:
        # Kendra can sometime take a while to sync and process the documents
        time.sleep(60)
        syncStatus = client.is_kendra_data_synching(pytest.workspace.get("id"))
        syncInProgress = syncStatus.get("isKendraDataSynching")
        syncRetries += 1
    assert syncInProgress == False

    documents = client.list_documents(
        input={"workspaceId": pytest.workspace.get("id"), "documentType": "file"}
    )
    pytest.document = documents.get("items")[0]
    assert pytest.document.get("status") == "processed"
    assert pytest.document.get("workspaceId") == pytest.workspace.get("id")


def test_semantic_search(client: AppSyncClient):
    if pytest.skip_flag == True:
        pytest.skip("Kendra is not enabled.")

    ready = False
    retries = 0
    while not ready and retries < 10:
        time.sleep(15)
        retries += 1
        result = client.semantic_search(
            input={
                "workspaceId": pytest.workspace.get("id"),
                "query": "yellow",
            }
        )
        if len(result.get("items")) == 1:
            ready = True
            assert result.get("engine") == "kendra"
            fileContent = result.get("items")[0].get("content")
            assert fileContent == "The Integ Test flower is yellow."
    assert ready == True


def test_query_llm(client, default_model, default_provider):
    if pytest.skip_flag == True:
        pytest.skip("Kendra is not enabled.")
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
    while not found and retries < 30:
        time.sleep(1)
        retries += 1
        session = client.get_session(session_id)
        if (
            session != None
            and len(session.get("history")) == 2
            and "yellow" in session.get("history")[1].get("content").lower()
        ):
            found = True
            break
    client.delete_session(session_id)
    assert found == True


def test_delete_document(client: AppSyncClient):
    if pytest.skip_flag == True:
        pytest.skip("Kendra is not enabled.")

    client.delete_document(
        input={
            "workspaceId": pytest.workspace.get("id"),
            "documentId": pytest.document.get("id"),
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
                "documentId": pytest.document.get("id"),
            }
        )
        if document == None:
            ready = True
            break
    assert ready == True


def test_delete_workspace(client: AppSyncClient):
    if pytest.skip_flag == True:
        pytest.skip("Kendra is not enabled.")
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
