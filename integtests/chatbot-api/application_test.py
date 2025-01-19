import json
import pytest
import time
import uuid
from clients.appsync_client import AppSyncClient


@pytest.fixture(scope="module", autouse=True)
def run_before_and_after_tests(client: AppSyncClient):
    for application in client.list_applications():
        if application.get("name") == "INTEG_TEST_APP":
            client.delete_application(application.get("id"))


def test_create_application(client: AppSyncClient):
    pytest.application = client.create_application(
        input={
            "name": "INTEG_TEST_APP",
            "model": "bedrock::anthropic.claude-instant-v1",
            "roles": ["user"],
            "allowImageInput": True,
            "allowVideoInput": True,
            "allowDocumentInput": False,
            "enableGuardrails": True,
            "streaming": True,
            "maxTokens": 512,
            "temperature": 0.6,
            "topP": 0.9,
        }
    )

    assert pytest.application.get("id") is not None
    assert pytest.application.get("name") == "INTEG_TEST_APP"
    assert pytest.application.get("roles") == ["user"]
    assert pytest.application.get("allowImageInput") == True
    assert pytest.application.get("allowVideoInput") == True
    assert pytest.application.get("allowDocumentInput") == False
    assert pytest.application.get("enableGuardrails") == True
    assert pytest.application.get("streaming") == True
    assert pytest.application.get("maxTokens") == 512
    assert pytest.application.get("temperature") == 0.6
    assert pytest.application.get("topP") == 0.9


def test_get_application(client: AppSyncClient):
    application = client.get_application(pytest.application.get("id"))
    assert application.get("id") == pytest.application.get("id")
    assert application.get("name") == "INTEG_TEST_APP"
    assert application.get("roles") == ["user"]
    assert application.get("allowImageInput") == True
    assert application.get("allowVideoInput") == True
    assert application.get("allowDocumentInput") == False
    assert application.get("enableGuardrails") == True
    assert application.get("streaming") == True
    assert application.get("maxTokens") == 512
    assert application.get("temperature") == 0.6
    assert application.get("topP") == 0.9


def test_list_applications(client: AppSyncClient):
    applications = client.list_applications()
    assert len(applications) > 0


def test_query_application(client):
    session_id = str(uuid.uuid4())
    request = {
        "action": "run",
        "modelInterface": "langchain",
        "applicationId": pytest.application.get("id"),
        "data": {
            "mode": "chain",
            "text": "When was Mark Twain born?",
            "images": [],
            "documents": [],
            "videos": [],
            "sessionId": session_id,
        },
    }

    client.send_query(json.dumps(request))

    found = False
    retries = 0
    while not found and retries < 10:
        time.sleep(5)
        retries += 1
        session = client.get_session(session_id)

        if (
            session != None
            and len(session.get("history")) > 0
            and "1835" in session.get("history")[1].get("content")
        ):
            found = True
            break
    client.delete_session(session_id)
    assert found == True


def test_update_application(client: AppSyncClient):
    application = client.update_application(
        input={
            "id": pytest.application.get("id"),
            "name": "INTEG_TEST_APP",
            "model": "bedrock::anthropic.claude-instant-v1",
            "roles": ["user", "admin"],
            "allowImageInput": False,
            "allowVideoInput": False,
            "allowDocumentInput": True,
            "enableGuardrails": False,
            "streaming": False,
            "maxTokens": 1024,
            "temperature": 0.8,
            "topP": 0.7,
            "createTime": pytest.application.get("createTime"),
        }
    )
    assert application is not None

    assert application.get("id") is not None
    assert application.get("name") == "INTEG_TEST_APP"
    assert application.get("roles") == ["user", "admin"]
    assert application.get("allowImageInput") == False
    assert application.get("allowVideoInput") == False
    assert application.get("allowDocumentInput") == True
    assert application.get("enableGuardrails") == False
    assert application.get("streaming") == False
    assert application.get("maxTokens") == 1024
    assert application.get("temperature") == 0.8
    assert application.get("topP") == 0.7


def test_delete_application(client: AppSyncClient):
    result = client.delete_application(pytest.application.get("id"))
    assert result == True
