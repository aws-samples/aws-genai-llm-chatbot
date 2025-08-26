import json
import uuid
import time
import pytest
from clients.appsync_client import AppSyncClient


@pytest.fixture(scope="function")
def agent_session_id():
    return str(uuid.uuid4())


@pytest.fixture(scope="module")
def available_agent(client: AppSyncClient):
    agents = client.list_agents()
    if not agents:
        pytest.skip("No agents available")
    return agents[0]


def _wait_for_session(
    client: AppSyncClient,
    session_id: str,
    expected_messages: int = 2,
    timeout: int = 30,
):
    """Wait for async message processing"""
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            session = client.get_session(session_id)
            if session and len(session.get("history", [])) >= expected_messages:
                return session
        except Exception:
            pass
        time.sleep(1)
    raise TimeoutError(
        f"{session_id} did not reach {expected_messages} messages within {timeout}s"
    )


def test_agent_conversation_single_turn(
    client: AppSyncClient, available_agent, agent_session_id
):
    """Test basic agent query → response flow"""
    agent_id = available_agent["agentRuntimeArn"]

    request = {
        "action": "run",
        "modelInterface": "agent",
        "data": {
            "mode": "chain",
            "text": "Hello, what can you help me with?",
            "agentRuntimeArn": agent_id,
            "sessionId": agent_session_id,
            "documents": [],
            "images": [],
            "videos": [],
            "modelName": "anthropic.claude-3-haiku-20240307-v1:0",
            "provider": "bedrock",
            "modelKwargs": {
                "streaming": False,
                "maxTokens": 2000,
                "temperature": 0.7,
                "topP": 0.9,
            },
        },
    }

    client.send_query(json.dumps(request))
    session = _wait_for_session(client, agent_session_id, expected_messages=2)

    assert len(session["history"]) == 2
    assert session["history"][0]["type"] == "human"
    assert session["history"][1]["type"] == "ai"

    # Verify AI response contains agent metadata
    ai_metadata = json.loads(session["history"][1]["metadata"])
    assert ai_metadata["provider"] == "bedrock-agents"
    assert ai_metadata["sessionId"] == agent_session_id


def test_agent_conversation_multi_turn(
    client: AppSyncClient, available_agent, agent_session_id
):
    """Test conversation context preservation"""
    agent_id = available_agent["agentRuntimeArn"]

    # First message
    request1 = {
        "action": "run",
        "modelInterface": "agent",
        "data": {
            "mode": "chain",
            "text": "My name is John. What's the weather?",
            "agentRuntimeArn": agent_id,
            "sessionId": agent_session_id,
            "documents": [],
            "images": [],
            "videos": [],
            "modelName": "anthropic.claude-3-haiku-20240307-v1:0",
            "provider": "bedrock",
            "modelKwargs": {
                "streaming": False,
                "maxTokens": 2000,
                "temperature": 0.7,
                "topP": 0.9,
            },
        },
    }

    client.send_query(json.dumps(request1))
    _wait_for_session(client, agent_session_id, expected_messages=2)

    time.sleep(2)  # Brief delay between requests

    # Follow-up message
    request2 = {
        "action": "run",
        "modelInterface": "agent",
        "data": {
            "mode": "chain",
            "text": "Do you remember my name?",
            "agentRuntimeArn": agent_id,
            "sessionId": agent_session_id,
            "documents": [],
            "images": [],
            "videos": [],
            "modelName": "anthropic.claude-3-haiku-20240307-v1:0",
            "provider": "bedrock",
            "modelKwargs": {
                "streaming": False,
                "maxTokens": 2000,
                "temperature": 0.7,
                "topP": 0.9,
            },
        },
    }

    client.send_query(json.dumps(request2))
    session = _wait_for_session(client, agent_session_id, expected_messages=4)

    assert len(session["history"]) == 4
    # Verify message alternation: human → ai → human → ai
    assert session["history"][0]["type"] == "human"
    assert session["history"][1]["type"] == "ai"
    assert session["history"][2]["type"] == "human"
    assert session["history"][3]["type"] == "ai"


def test_agent_conversation_error_handling(client: AppSyncClient, agent_session_id):
    """Test invalid agent ID handling"""
    request = {
        "action": "run",
        "modelInterface": "agent",
        "data": {
            "mode": "chain",
            "text": "Test message",
            "agentRuntimeArn": "invalid-agent-id-12345",
            "sessionId": agent_session_id,
            "documents": [],
            "images": [],
            "videos": [],
            "modelName": "anthropic.claude-3-haiku-20240307-v1:0",
            "provider": "bedrock",
            "modelKwargs": {
                "streaming": False,
                "maxTokens": 2000,
                "temperature": 0.7,
                "topP": 0.9,
            },
        },
    }

    # Should not raise exception
    try:
        client.send_query(json.dumps(request))
        # Wait briefly for error processing
        time.sleep(5)

        # Check if session exists and has error handling
        session = client.get_session(agent_session_id)
        if session:
            # If session exists, verify it handled the error gracefully
            assert len(session.get("history", [])) >= 1
    except Exception as e:
        # Verify it's a graceful error, not a system crash
        assert "invalid" in str(e).lower() or "not found" in str(e).lower()


def test_agent_conversation_session_persistence(
    client: AppSyncClient, available_agent, agent_session_id
):
    """Test conversation persistence over time"""
    agent_id = available_agent["agentRuntimeArn"]

    messages = [
        "What is 2 + 2?",
        "What is 5 * 3?",
        "Can you summarize our math conversation?",
    ]

    for i, message in enumerate(messages):
        request = {
            "action": "run",
            "modelInterface": "agent",
            "data": {
                "mode": "chain",
                "text": message,
                "agentRuntimeArn": agent_id,
                "sessionId": agent_session_id,
                "documents": [],
                "images": [],
                "videos": [],
                "modelName": "anthropic.claude-3-haiku-20240307-v1:0",
                "provider": "bedrock",
                "modelKwargs": {
                    "streaming": False,
                    "maxTokens": 2000,
                    "temperature": 0.7,
                    "topP": 0.9,
                },
            },
        }

        client.send_query(json.dumps(request))
        expected_messages = (i + 1) * 2  # Each turn creates 2 messages
        _wait_for_session(client, agent_session_id, expected_messages=expected_messages)

        if i < len(messages) - 1:  # Don't delay after last message
            time.sleep(2)

    # Final verification
    session = client.get_session(agent_session_id)
    assert len(session["history"]) == 6  # 3 turns = 6 messages

    # Verify message order and content
    for i in range(0, 6, 2):
        assert session["history"][i]["type"] == "human"
        assert session["history"][i + 1]["type"] == "ai"


def test_agent_conversation_cleanup(client: AppSyncClient, available_agent):
    """Test session deletion"""
    cleanup_session_id = str(uuid.uuid4())
    agent_id = available_agent["agentRuntimeArn"]

    # Create conversation
    request = {
        "action": "run",
        "modelInterface": "agent",
        "data": {
            "mode": "chain",
            "text": "Test message for cleanup",
            "agentRuntimeArn": agent_id,
            "sessionId": cleanup_session_id,
            "documents": [],
            "images": [],
            "videos": [],
            "modelName": "anthropic.claude-3-haiku-20240307-v1:0",
            "provider": "bedrock",
            "modelKwargs": {
                "streaming": False,
                "maxTokens": 2000,
                "temperature": 0.7,
                "topP": 0.9,
            },
        },
    }

    client.send_query(json.dumps(request))
    _wait_for_session(client, cleanup_session_id, expected_messages=2)

    # Delete session
    client.delete_session(cleanup_session_id)

    # Verify session no longer exists
    time.sleep(2)
    try:
        session = client.get_session(cleanup_session_id)
        assert session is None or len(session.get("history", [])) == 0
    except Exception:
        # Exception is acceptable - session doesn't exist
        pass
