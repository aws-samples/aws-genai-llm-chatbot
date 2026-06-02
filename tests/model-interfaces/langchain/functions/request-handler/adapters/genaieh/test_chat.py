"""Tests for GenAIEH Chat Adapter."""

import pytest
from unittest.mock import Mock
from adapters.genaieh.bedrock_chat import GenAIEHChatAdapter
from genai_core.model_providers.genaieh.types import ApiError


@pytest.fixture
def mock_genaieh_client():
    """Mock GenAIEH Gateway client."""
    client = Mock()
    client.invoke_bedrock_converse.return_value = {
        "output": {"message": {"content": [{"text": "Test response"}]}},
        "usage": {"totalTokens": 100},
    }
    return client


@pytest.fixture
def chat_adapter(mock_genaieh_client):
    """Create chat adapter with mocked dependencies."""
    adapter = GenAIEHChatAdapter(
        model_id="test-model", session_id="test-session", user_id="test-user"
    )
    adapter.chat_history = Mock()
    adapter.chat_history.messages = []
    adapter._genaieh_client = mock_genaieh_client
    return adapter


def test_chat_adapter_initialization():
    """Test chat adapter initialization."""
    adapter = GenAIEHChatAdapter(
        model_id="test-model", session_id="test-session", user_id="test-user"
    )
    assert adapter.model_id == "test-model"
    assert adapter.session_id == "test-session"


def test_successful_chat_request(chat_adapter, mock_genaieh_client):
    """Test successful chat request."""
    response = chat_adapter.run(
        prompt="Hello", system_prompts={"system_prompt": "You are helpful"}
    )

    assert response["type"] == "text"
    assert response["content"] == "Test response"
    assert response["sessionId"] == "test-session"
    mock_genaieh_client.invoke_bedrock_converse.assert_called_once()


def test_api_error_handling(chat_adapter, mock_genaieh_client):
    """Test API error handling."""
    mock_genaieh_client.invoke_bedrock_converse.return_value = ApiError(
        error_type="HTTP 429",
        message="""I'm currently experiencing high demand.
        Please wait a moment and try again.""",
    )

    response = chat_adapter.run(prompt="Hello")

    assert response["type"] == "error"
    assert "high demand" in response["content"]


def test_unsupported_features(chat_adapter):
    """Test validation of unsupported features."""
    with pytest.raises(ValueError, match="file attachments"):
        chat_adapter.run(prompt="Hello", images=[{"url": "test.jpg"}])

    with pytest.raises(ValueError, match="workspace/RAG"):
        chat_adapter.run(prompt="Hello", workspace_id="test-workspace")
