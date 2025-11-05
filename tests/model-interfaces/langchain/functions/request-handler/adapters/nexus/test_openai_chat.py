"""Tests for Nexus OpenAI Chat Adapter."""

import pytest
import json
from unittest.mock import Mock
from adapters.nexus.openai_chat import NexusOpenAIChatAdapter
from genai_core.model_providers.nexus.types import ApiError


@pytest.fixture
def mock_nexus_client():
    """Mock Nexus Gateway client for OpenAI."""
    client = Mock()
    client.invoke_openai_chat.return_value = json.dumps(
        {
            "choices": [{"message": {"content": "Test OpenAI response"}}],
            "usage": {
                "total_tokens": 150,
                "prompt_tokens": 50,
                "completion_tokens": 100,
            },
        }
    )
    client.invoke_openai_stream_chat.return_value = {
        "chunks": ["Test ", "OpenAI ", "streaming ", "response"]
    }
    return client


@pytest.fixture
def openai_adapter(mock_nexus_client):
    """Create OpenAI chat adapter with mocked dependencies."""
    adapter = NexusOpenAIChatAdapter(
        model_id="gpt-4", session_id="test-session", user_id="test-user"
    )
    adapter.chat_history = Mock()
    adapter.chat_history.messages = []
    adapter._nexus_client = mock_nexus_client
    return adapter


def test_openai_adapter_initialization():
    """Test OpenAI chat adapter initialization."""
    adapter = NexusOpenAIChatAdapter(
        model_id="gpt-4", session_id="test-session", user_id="test-user"
    )
    assert adapter.model_id == "gpt-4"
    assert adapter.session_id == "test-session"
    # OpenAI adapter should enable streaming by default
    assert adapter.model_kwargs.get("streaming") is True


def test_successful_openai_chat_request(openai_adapter, mock_nexus_client):
    """Test successful OpenAI chat request."""
    # Disable streaming for this test
    openai_adapter.model_kwargs["streaming"] = False

    # Mock callback handler properly
    openai_adapter.callback_handler = Mock()
    openai_adapter.callback_handler.prompts = []

    response = openai_adapter.run(
        prompt="Hello", system_prompts={"system_prompt": "You are helpful"}
    )

    assert response["type"] == "text"
    assert response["content"] == "Test OpenAI response"
    assert response["sessionId"] == "test-session"
    mock_nexus_client.invoke_openai_chat.assert_called_once()


def test_successful_openai_streaming_request(openai_adapter, mock_nexus_client):
    """Test successful OpenAI streaming chat request."""
    # Mock callback handler properly
    openai_adapter.callback_handler = Mock()
    openai_adapter.callback_handler.prompts = []

    response = openai_adapter.run(
        prompt="Hello", system_prompts={"system_prompt": "You are helpful"}
    )

    assert response["type"] == "text"
    assert response["content"] == "Test OpenAI streaming response"
    assert response["sessionId"] == "test-session"
    mock_nexus_client.invoke_openai_stream_chat.assert_called_once()


def test_openai_api_error_handling(openai_adapter, mock_nexus_client):
    """Test OpenAI API error handling."""
    mock_nexus_client.invoke_openai_chat.return_value = ApiError(
        error_type="HTTP 429", message="Rate limit exceeded. Please try again later."
    )

    # Disable streaming for this test
    openai_adapter.model_kwargs["streaming"] = False

    response = openai_adapter.run(prompt="Hello")

    assert response["type"] == "error"
    assert "Rate limit exceeded" in response["content"]


def test_openai_streaming_api_error_handling(openai_adapter, mock_nexus_client):
    """Test OpenAI streaming API error handling."""
    mock_nexus_client.invoke_openai_stream_chat.return_value = ApiError(
        error_type="HTTP 500", message="Internal server error"
    )

    response = openai_adapter.run(prompt="Hello")

    assert response["type"] == "error"
    assert "Internal server error" in response["content"]


def test_openai_unsupported_features(openai_adapter):
    """Test validation of unsupported features for OpenAI adapter."""
    with pytest.raises(ValueError, match="file attachments"):
        openai_adapter.run(prompt="Hello", images=[{"url": "test.jpg"}])

    with pytest.raises(ValueError, match="file attachments"):
        openai_adapter.run(prompt="Hello", documents=[{"url": "test.pdf"}])

    with pytest.raises(ValueError, match="file attachments"):
        openai_adapter.run(prompt="Hello", videos=[{"url": "test.mp4"}])

    with pytest.raises(ValueError, match="workspace/RAG"):
        openai_adapter.run(prompt="Hello", workspace_id="test-workspace")


def test_openai_build_request_body(openai_adapter):
    """Test OpenAI request body building."""
    openai_adapter.model_kwargs = {"temperature": 0.7, "maxTokens": 1000, "topP": 0.9}

    request_body = openai_adapter.build_openai_request_body(
        "gpt-4", "Hello", "You are helpful"
    )

    assert request_body["model"] == "gpt-4"
    assert len(request_body["messages"]) == 2  # system + user message
    assert request_body["messages"][0]["role"] == "system"
    assert request_body["messages"][0]["content"] == "You are helpful"
    assert request_body["messages"][1]["role"] == "user"
    assert request_body["messages"][1]["content"] == "Hello"
    assert request_body["temperature"] == 0.7
    assert request_body["max_completion_tokens"] == 1000
    assert request_body["top_p"] == 0.9


def test_openai_extract_chat_response(openai_adapter):
    """Test OpenAI chat response extraction."""
    # Test with dict response
    response_dict = {"choices": [{"message": {"content": "Hello world"}}]}
    result = openai_adapter._extract_openai_chat_response(response_dict)
    assert result == "Hello world"

    # Test with JSON string response
    response_json = json.dumps(response_dict)
    result = openai_adapter._extract_openai_chat_response(response_json)
    assert result == "Hello world"

    # Test with invalid response
    result = openai_adapter._extract_openai_chat_response("invalid")
    assert result == ""


def test_openai_process_streaming_response(openai_adapter):
    """Test OpenAI streaming response processing."""
    # Mock the on_llm_new_token method
    openai_adapter.on_llm_new_token = Mock()

    response = {"chunks": ["Hello", " ", "world"]}
    result = openai_adapter._process_openai_streaming_response(response)

    assert result == "Hello world"
    assert openai_adapter.on_llm_new_token.call_count == 3


def test_openai_conversation_history_handling(openai_adapter, mock_nexus_client):
    """Test conversation history handling in OpenAI requests."""
    # Test that conversation history is properly retrieved and formatted
    # For this test, we'll mock the get_conversation_history method directly
    # since the chat history processing is complex

    mock_history = [
        {"role": "user", "content": [{"text": "Previous user message"}]},
        {"role": "assistant", "content": [{"text": "Previous AI response"}]},
    ]

    openai_adapter.get_conversation_history = Mock(return_value=mock_history)
    openai_adapter.model_kwargs["streaming"] = False

    # Mock callback handler properly
    openai_adapter.callback_handler = Mock()
    openai_adapter.callback_handler.prompts = []

    openai_adapter.run(prompt="New message")

    # Verify the request was made with conversation history
    mock_nexus_client.invoke_openai_chat.assert_called_once()
    call_args = mock_nexus_client.invoke_openai_chat.call_args[1]
    messages = call_args["body"]["messages"]

    # Should have 3 messages: 2 from history + 1 new (converted to OpenAI format)
    assert len(messages) == 3
    assert messages[0]["role"] == "user"
    assert (
        messages[0]["content"] == "Previous user message"
    )  # Converted from Bedrock format
    assert messages[1]["role"] == "assistant"
    assert (
        messages[1]["content"] == "Previous AI response"
    )  # Converted from Bedrock format
    assert messages[2]["role"] == "user"
    assert messages[2]["content"] == "New message"


def test_openai_system_prompt_handling(openai_adapter, mock_nexus_client):
    """Test system prompt handling in OpenAI requests."""
    openai_adapter.model_kwargs["streaming"] = False

    openai_adapter.run(
        prompt="Hello", system_prompts={"system_prompt": "You are a helpful assistant"}
    )

    call_args = mock_nexus_client.invoke_openai_chat.call_args[1]
    request_body = call_args["body"]

    # OpenAI uses messages format, system prompt should be in the request body
    assert "messages" in request_body
    # The system prompt handling is done in build_message_body from base class
    # which adds it to the message body structure


def test_openai_token_usage_logging(openai_adapter, mock_nexus_client):
    """Test token usage logging for OpenAI responses."""
    openai_adapter.callback_handler = Mock()
    openai_adapter.callback_handler.prompts = []
    openai_adapter.callback_handler.usage = {}
    openai_adapter.model_kwargs["streaming"] = False

    # Mock response with usage data - return dict instead of JSON string
    mock_nexus_client.invoke_openai_chat.return_value = {
        "choices": [{"message": {"content": "Test response"}}],
        "usage": {"total_tokens": 150, "prompt_tokens": 50, "completion_tokens": 100},
    }

    openai_adapter.run(prompt="Hello")

    # Verify usage was logged
    assert hasattr(openai_adapter.callback_handler, "usage")
    usage = openai_adapter.callback_handler.usage
    assert usage["total_tokens"] == 150
    assert usage["input_tokens"] == 50
    assert usage["output_tokens"] == 100
