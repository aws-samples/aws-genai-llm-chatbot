"""Tests for Nexus Streaming Adapter."""

import pytest
from unittest.mock import Mock
from adapters.nexus.stream import NexusChatStreamAdapter
from genai_core.model_providers.nexus.types import ApiError


@pytest.fixture
def mock_nexus_client():
    """Mock Nexus Gateway client."""
    client = Mock()
    client.invoke_bedrock_converse_stream.return_value = {
        "stream": [
            {"contentBlockDelta": {"delta": {"text": "Hello"}}},
            {"contentBlockDelta": {"delta": {"text": " world"}}},
        ]
    }
    client.invoke_bedrock_converse.return_value = {
        "output": {"message": {"content": [{"text": "Fallback response"}]}}
    }
    return client


@pytest.fixture
def stream_adapter(mock_nexus_client):
    """Create streaming adapter with mocked dependencies."""
    adapter = NexusChatStreamAdapter(
        model_id="test-model", session_id="test-session", user_id="test-user"
    )
    adapter.chat_history = Mock()
    adapter.chat_history.messages = []
    adapter.disable_streaming = False
    adapter._nexus_client = mock_nexus_client
    return adapter


def test_streaming_adapter_initialization():
    """Test streaming adapter initialization."""
    adapter = NexusChatStreamAdapter(
        model_id="test-model", session_id="test-session", user_id="test-user"
    )
    assert adapter.model_kwargs["streaming"] is True


def test_streaming_request(stream_adapter, mock_nexus_client):
    """Test streaming request processing."""
    response = stream_adapter.run(prompt="Hello")

    assert response["type"] == "text"
    assert response["content"] == "Hello world"
    mock_nexus_client.invoke_bedrock_converse_stream.assert_called_once()


def test_fallback_to_non_streaming(stream_adapter, mock_nexus_client):
    """Test fallback to non-streaming when disabled."""
    stream_adapter.disable_streaming = True

    response = stream_adapter.run(prompt="Hello")

    assert response["content"] == "Fallback response"
    mock_nexus_client.invoke_bedrock_converse.assert_called_once()


def test_streaming_error_handling(stream_adapter, mock_nexus_client):
    """Test streaming error handling."""
    mock_nexus_client.invoke_bedrock_converse_stream.return_value = ApiError(
        error_type="HTTP 500",
        message="""The service is temporarily unavailable.
        Please try again in a few moments.""",
    )

    response = stream_adapter.run(prompt="Hello")

    assert response["type"] == "error"
    assert "temporarily unavailable" in response["content"]
