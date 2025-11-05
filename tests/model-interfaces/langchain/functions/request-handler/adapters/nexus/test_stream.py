"""Tests for Nexus Chat Adapter for streaming models"""

import pytest
from unittest.mock import Mock, call
from adapters.nexus.bedrock_chat import NexusChatAdapter
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
    adapter = NexusChatAdapter(
        model_id="test-model", session_id="test-session", user_id="test-user"
    )
    adapter.chat_history = Mock()
    adapter.chat_history.messages = []
    adapter.disable_streaming = False
    adapter.model_kwargs = {"streaming": True}
    adapter._nexus_client = mock_nexus_client
    return adapter


def test_streaming_request(stream_adapter, mock_nexus_client):
    """Test streaming request processing."""
    response = stream_adapter.run(prompt="Hello")

    assert response["type"] == "text"
    assert "Hello" in response["content"] and "world" in response["content"]
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


def test_on_llm_new_token_called_with_streaming_tokens(
    stream_adapter, mock_nexus_client
):
    """Test that on_llm_new_token is called with each streaming token."""
    # Mock the on_llm_new_token method to track calls
    original_method = stream_adapter.on_llm_new_token
    stream_adapter.on_llm_new_token = Mock(side_effect=original_method)

    response = stream_adapter.run(prompt="Hello")

    # Verify on_llm_new_token was called with correct signature for each token
    expected_calls = [
        call(
            "Hello",
            run_id=None,
            chunk={"contentBlockDelta": {"delta": {"text": "Hello"}}},
            parent_run_id=None,
        ),
        call(
            " world",
            run_id=None,
            chunk={"contentBlockDelta": {"delta": {"text": " world"}}},
            parent_run_id=None,
        ),
    ]
    stream_adapter.on_llm_new_token.assert_has_calls(expected_calls)
    assert stream_adapter.on_llm_new_token.call_count == 2

    # Verify final response
    assert response["type"] == "text"
    assert "Hello" in response["content"] and "world" in response["content"]
