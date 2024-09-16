import json
import uuid
import time

import pytest


def test_create_session(client, default_model, default_provider, session_id):
    request = {
        "action": "run",
        "modelInterface": "langchain",
        "data": {
            "mode": "chain",
            "text": "test",
            "files": [],
            "modelName": default_model,
            "provider": default_provider,
            "sessionId": session_id,
        },
    }

    client.send_query(json.dumps(request))
    # Need a second sessions to verify the delete all
    request["data"]["sessionId"] = str(uuid.uuid4())
    client.send_query(json.dumps(request))

    found = False
    sessionFound = None
    retries = 0
    while not found and retries < 30:
        time.sleep(1)
        retries += 1
        sessions = client.list_sessions()
        for session in sessions:
            if len(sessions) >= 2 and session.get("id") == session_id:
                found = True
                sessionFound = session
                break

    assert found == True

    assert sessionFound.get("title") == request.get("data").get("text")


def test_get_session(client, session_id, default_model):
    session = client.get_session(session_id)
    assert session.get("id") == session_id
    assert session.get("title") == "test"
    assert len(session.get("history")) == 2
    assert session.get("history")[0].get("type") == "human"
    assert session.get("history")[1].get("type") == "ai"
    assert session.get("history")[1].get("metadata") is not None
    metadata = json.loads(session.get("history")[1].get("metadata"))
    assert metadata.get("usage") is not None
    assert metadata.get("usage").get("total_tokens") > 0


def test_delete_session(client, session_id):
    session = client.delete_session(session_id)
    assert session.get("id") == session_id
    assert session.get("deleted") == True

    session = client.get_session(session_id)
    assert session == None


def test_delete_user_sessions(client):
    sessions = client.delete_user_sessions()
    assert len(sessions) > 0
    assert sessions[0].get("deleted") == True

    sessions = client.list_sessions()
    retries = 0
    while True:
        time.sleep(1)
        retries += 1
        if retries > 10:
            pytest.fail()
        elif len(client.list_sessions()) == 0:
            break


@pytest.fixture(scope="package")
def session_id():
    return str(uuid.uuid4())
