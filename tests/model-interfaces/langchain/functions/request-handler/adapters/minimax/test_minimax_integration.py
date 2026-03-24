"""Integration tests for MiniMax adapter with the registry system."""
import os
import pytest
from unittest.mock import patch, MagicMock

from genai_core.registry import AdapterRegistry
from adapters.minimax.minimax_chat import MinimaxChatAdapter


@pytest.fixture(autouse=True)
def mock_nexus():
    with patch("genai_core.clients.is_nexus_configured", return_value=(False, {})):
        yield


@pytest.fixture(autouse=True)
def mock_models():
    with patch("genai_core.models.get_model_by_name", return_value=None):
        yield


def test_registry_matches_minimax_models():
    """Test that the registry correctly matches minimax model patterns."""
    reg = AdapterRegistry()
    reg.register(r"^minimax*", MinimaxChatAdapter)

    adapter_class = reg._get_adapter("minimax.MiniMax-M2.7")
    assert adapter_class is MinimaxChatAdapter

    adapter_class = reg._get_adapter("minimax.MiniMax-M2.5")
    assert adapter_class is MinimaxChatAdapter

    adapter_class = reg._get_adapter("minimax.MiniMax-M2.5-highspeed")
    assert adapter_class is MinimaxChatAdapter


def test_registry_does_not_match_other_providers():
    """Test that minimax pattern does not match other providers."""
    reg = AdapterRegistry()
    reg.register(r"^minimax*", MinimaxChatAdapter)

    with pytest.raises(ValueError):
        reg._get_adapter("openai.gpt-4")


def test_adapter_end_to_end():
    """Test adapter can be instantiated and produces a valid LLM."""
    os.environ["MINIMAX_API_KEY"] = "test-integration-key"
    try:
        with (
            patch("genai_core.langchain.DynamoDBChatMessageHistory"),
            patch("genai_core.clients.get_bedrock_client"),
            patch("adapters.minimax.minimax_chat.ChatOpenAI") as mock_chat,
        ):
            mock_llm = MagicMock()
            mock_chat.return_value = mock_llm

            adapter = MinimaxChatAdapter(
                model_id="MiniMax-M2.7",
                session_id="integration_session",
                user_id="integration_user",
                mode="chain",
                model_kwargs={},
            )

            llm = adapter.get_llm(
                model_kwargs={"streaming": True, "temperature": 0.8}
            )

            assert llm == mock_llm
            call_kwargs = mock_chat.call_args.kwargs
            assert call_kwargs["model_name"] == "MiniMax-M2.7"
            assert call_kwargs["openai_api_base"] == "https://api.minimax.io/v1"
            assert call_kwargs["streaming"] is True
            assert call_kwargs["temperature"] == 0.8
    finally:
        os.environ.pop("MINIMAX_API_KEY", None)
