import json
import uuid
import pytest
import os
import time


@pytest.mark.skipif(
    not all(
        [
            os.getenv("NEXUS_GATEWAY_URL"),
            os.getenv("NEXUS_AUTH_CLIENT_ID"),
            os.getenv("NEXUS_AUTH_CLIENT_SECRET"),
            os.getenv("NEXUS_AUTH_TOKEN_URL"),
        ]
    ),
    reason="Nexus Gateway credentials not configured",
)
def test_nexus_chat_request(client, nexus_model):
    """Test chat request using Nexus model through chatbot API"""
    session_id = str(uuid.uuid4())

    request = {
        "action": "run",
        "modelInterface": "langchain",
        "data": {
            "mode": "chain",
            "text": "Hello, please respond with just 'Hi there!'",
            "files": [],
            "modelName": nexus_model,
            "provider": "nexus",
            "sessionId": session_id,
        },
    }

    client.send_query(json.dumps(request))

    # Wait for session to be created and validate through session history
    retries = 0
    session = None
    while retries < 30:
        time.sleep(1)
        retries += 1
        session = client.get_session(session_id)
        if session and len(session.get("history", [])) == 2:
            break

    assert session is not None
    assert session.get("id") == session_id
    assert len(session.get("history")) == 2
    assert session.get("history")[0].get("type") == "human"
    assert session.get("history")[1].get("type") == "ai"
    assert len(session.get("history")[1].get("content", "")) > 0

    print(f"Nexus chat response: {session['history'][1]['content']}")

    # Cleanup
    client.delete_session(session_id)


@pytest.mark.skipif(
    not all(
        [
            os.getenv("NEXUS_GATEWAY_URL"),
            os.getenv("NEXUS_AUTH_CLIENT_ID"),
            os.getenv("NEXUS_AUTH_CLIENT_SECRET"),
            os.getenv("NEXUS_AUTH_TOKEN_URL"),
        ]
    ),
    reason="Nexus Gateway credentials not configured",
)
def test_nexus_streaming_request(client, nexus_model):
    """Test streaming chat request using Nexus model"""
    session_id = str(uuid.uuid4())

    request = {
        "action": "run",
        "modelInterface": "langchain",
        "data": {
            "mode": "chain",
            "text": "Count from 1 to 5",
            "files": [],
            "modelName": nexus_model,
            "provider": "nexus",
            "sessionId": session_id,
            "streaming": True,
        },
    }

    client.send_query(json.dumps(request))

    # Wait for session to be created and validate through session history
    retries = 0
    session = None
    while retries < 30:
        time.sleep(1)
        retries += 1
        session = client.get_session(session_id)
        if session and len(session.get("history", [])) == 2:
            break

    assert session is not None
    assert session.get("id") == session_id
    assert len(session.get("history")) == 2
    assert session.get("history")[0].get("type") == "human"
    assert session.get("history")[1].get("type") == "ai"
    assert len(session.get("history")[1].get("content", "")) > 0

    print(f"Nexus streaming response: {session['history'][1]['content']}")

    # Cleanup
    client.delete_session(session_id)


@pytest.mark.skipif(
    not all(
        [
            os.getenv("NEXUS_GATEWAY_URL"),
            os.getenv("NEXUS_AUTH_CLIENT_ID"),
            os.getenv("NEXUS_AUTH_CLIENT_SECRET"),
            os.getenv("NEXUS_AUTH_TOKEN_URL"),
        ]
    ),
    reason="Nexus Gateway credentials not configured",
)
def test_nexus_conversation_history(client, nexus_model):
    """Test conversation history with Nexus model"""
    session_id = str(uuid.uuid4())

    # First message
    request1 = {
        "action": "run",
        "modelInterface": "langchain",
        "data": {
            "mode": "chain",
            "text": "My name is Alice",
            "files": [],
            "modelName": nexus_model,
            "provider": "nexus",
            "sessionId": session_id,
        },
    }

    client.send_query(json.dumps(request1))

    # Wait for first response
    retries = 0
    while retries < 30:
        time.sleep(1)
        retries += 1
        session = client.get_session(session_id)
        if session and len(session.get("history", [])) == 2:
            break

    # Second message referencing first
    request2 = {
        "action": "run",
        "modelInterface": "langchain",
        "data": {
            "mode": "chain",
            "text": "What is my name?",
            "files": [],
            "modelName": nexus_model,
            "provider": "nexus",
            "sessionId": session_id,
        },
    }

    client.send_query(json.dumps(request2))

    # Wait for second response
    retries = 0
    final_session = None
    while retries < 30:
        time.sleep(1)
        retries += 1
        final_session = client.get_session(session_id)
        if final_session and len(final_session.get("history", [])) == 4:
            break

    assert final_session is not None
    assert len(final_session.get("history")) == 4
    assert final_session.get("history")[2].get("type") == "human"
    assert final_session.get("history")[3].get("type") == "ai"

    second_response = final_session["history"][3]["content"]
    assert "Alice" in second_response or "alice" in second_response.lower()

    print(f"First response: {final_session['history'][1]['content']}")
    print(f"Second response: {second_response}")

    # Cleanup
    client.delete_session(session_id)


@pytest.fixture(scope="session")
def nexus_model():
    """Get Nexus model name from environment or use default"""
    return os.getenv("NEXUS_TEST_MODEL_NAME", "gpt-3.5-turbo")
