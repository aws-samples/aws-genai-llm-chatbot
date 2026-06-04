import os
import pytest
from unittest.mock import patch, MagicMock

from adapters.minimax.minimax_chat import MinimaxChatAdapter
from genai_core.types import ChatbotMode


@pytest.fixture
def adapter():
    os.environ["MINIMAX_API_KEY"] = "test-minimax-key"
    with (
        patch("genai_core.langchain.DynamoDBChatMessageHistory"),
        patch("genai_core.clients.get_bedrock_client"),
    ):
        adapter = MinimaxChatAdapter(
            model_id="MiniMax-M2.7",
            session_id="test_session",
            user_id="test_user",
            mode=ChatbotMode.CHAIN.value,
            model_kwargs={},
        )
        yield adapter
    os.environ.pop("MINIMAX_API_KEY", None)


def test_get_llm_basic(adapter):
    """Test that get_llm returns a ChatOpenAI configured for MiniMax."""
    with patch("adapters.minimax.minimax_chat.ChatOpenAI") as mock_chat:
        mock_chat.return_value = MagicMock()
        llm = adapter.get_llm()

        mock_chat.assert_called_once()
        call_kwargs = mock_chat.call_args
        assert call_kwargs.kwargs["model_name"] == "MiniMax-M2.7"
        assert call_kwargs.kwargs["openai_api_key"] == "test-minimax-key"
        assert call_kwargs.kwargs["openai_api_base"] == "https://api.minimax.io/v1"


def test_get_llm_with_streaming(adapter):
    """Test that streaming is passed through to ChatOpenAI."""
    with patch("adapters.minimax.minimax_chat.ChatOpenAI") as mock_chat:
        mock_chat.return_value = MagicMock()
        adapter.get_llm(model_kwargs={"streaming": True})

        call_kwargs = mock_chat.call_args.kwargs
        assert call_kwargs["streaming"] is True


def test_get_llm_with_temperature(adapter):
    """Test that temperature is clamped to [0, 1]."""
    with patch("adapters.minimax.minimax_chat.ChatOpenAI") as mock_chat:
        mock_chat.return_value = MagicMock()
        adapter.get_llm(model_kwargs={"temperature": 0.7})
        assert mock_chat.call_args.kwargs["temperature"] == 0.7


def test_get_llm_clamps_temperature_high(adapter):
    """Test that temperature > 1 is clamped to 1."""
    with patch("adapters.minimax.minimax_chat.ChatOpenAI") as mock_chat:
        mock_chat.return_value = MagicMock()
        adapter.get_llm(model_kwargs={"temperature": 2.0})
        assert mock_chat.call_args.kwargs["temperature"] == 1.0


def test_get_llm_clamps_temperature_low(adapter):
    """Test that temperature < 0 is clamped to 0."""
    with patch("adapters.minimax.minimax_chat.ChatOpenAI") as mock_chat:
        mock_chat.return_value = MagicMock()
        adapter.get_llm(model_kwargs={"temperature": -0.5})
        assert mock_chat.call_args.kwargs["temperature"] == 0.0


def test_get_llm_with_max_tokens(adapter):
    """Test that maxTokens is mapped to max_tokens."""
    with patch("adapters.minimax.minimax_chat.ChatOpenAI") as mock_chat:
        mock_chat.return_value = MagicMock()
        adapter.get_llm(model_kwargs={"maxTokens": 4096})
        assert mock_chat.call_args.kwargs["max_tokens"] == 4096


def test_get_llm_missing_api_key():
    """Test that missing API key raises an exception during construction."""
    os.environ.pop("MINIMAX_API_KEY", None)
    with (
        patch("genai_core.langchain.DynamoDBChatMessageHistory"),
        patch("genai_core.clients.get_bedrock_client"),
    ):
        with pytest.raises(Exception, match="MINIMAX_API_KEY must be set"):
            MinimaxChatAdapter(
                model_id="MiniMax-M2.7",
                session_id="test_session",
                user_id="test_user",
                mode=ChatbotMode.CHAIN.value,
                model_kwargs={},
            )


def test_get_llm_with_all_kwargs(adapter):
    """Test that all model kwargs are passed correctly."""
    with patch("adapters.minimax.minimax_chat.ChatOpenAI") as mock_chat:
        mock_chat.return_value = MagicMock()
        adapter.get_llm(
            model_kwargs={
                "streaming": True,
                "temperature": 0.5,
                "maxTokens": 2048,
            }
        )
        call_kwargs = mock_chat.call_args.kwargs
        assert call_kwargs["streaming"] is True
        assert call_kwargs["temperature"] == 0.5
        assert call_kwargs["max_tokens"] == 2048
        assert call_kwargs["openai_api_base"] == "https://api.minimax.io/v1"


def test_adapter_model_id(adapter):
    """Test that model_id is stored correctly."""
    assert adapter.model_id == "MiniMax-M2.7"


def test_get_llm_m25_model():
    """Test adapter works with M2.5 model."""
    os.environ["MINIMAX_API_KEY"] = "test-key"
    with (
        patch("genai_core.langchain.DynamoDBChatMessageHistory"),
        patch("genai_core.clients.get_bedrock_client"),
    ):
        adapter = MinimaxChatAdapter(
            model_id="MiniMax-M2.5",
            session_id="test_session",
            user_id="test_user",
            mode=ChatbotMode.CHAIN.value,
            model_kwargs={},
        )
        with patch("adapters.minimax.minimax_chat.ChatOpenAI") as mock_chat:
            mock_chat.return_value = MagicMock()
            adapter.get_llm()
            assert mock_chat.call_args.kwargs["model_name"] == "MiniMax-M2.5"
    os.environ.pop("MINIMAX_API_KEY", None)


def test_get_llm_m25_highspeed_model():
    """Test adapter works with M2.5-highspeed model."""
    os.environ["MINIMAX_API_KEY"] = "test-key"
    with (
        patch("genai_core.langchain.DynamoDBChatMessageHistory"),
        patch("genai_core.clients.get_bedrock_client"),
    ):
        adapter = MinimaxChatAdapter(
            model_id="MiniMax-M2.5-highspeed",
            session_id="test_session",
            user_id="test_user",
            mode=ChatbotMode.CHAIN.value,
            model_kwargs={},
        )
        with patch("adapters.minimax.minimax_chat.ChatOpenAI") as mock_chat:
            mock_chat.return_value = MagicMock()
            adapter.get_llm()
            assert (
                mock_chat.call_args.kwargs["model_name"]
                == "MiniMax-M2.5-highspeed"
            )
    os.environ.pop("MINIMAX_API_KEY", None)
