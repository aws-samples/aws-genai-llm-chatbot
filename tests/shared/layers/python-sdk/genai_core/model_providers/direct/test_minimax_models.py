from unittest.mock import patch

from genai_core.model_providers.direct.provider import (
    _list_minimax_models,
    _MINIMAX_MODELS,
)
from genai_core.types import Modality, ModelInterface, Provider


def test_list_minimax_models_returns_models_when_api_key_set():
    """Test that MiniMax models are returned when MINIMAX_API_KEY is available."""
    with patch(
        "genai_core.model_providers.direct.provider.genai_core.parameters.get_external_api_key"
    ) as mock_get_key:
        mock_get_key.return_value = "test-minimax-api-key"
        models = _list_minimax_models()

        assert models is not None
        assert len(models) == len(_MINIMAX_MODELS)

        for model in models:
            assert model["provider"] == Provider.MINIMAX.value
            assert model["streaming"] is True
            assert model["inputModalities"] == [Modality.TEXT.value]
            assert model["outputModalities"] == [Modality.TEXT.value]
            assert model["interface"] == ModelInterface.LANGCHAIN.value
            assert model["ragSupported"] is True
            assert model["bedrockGuardrails"] is False


def test_list_minimax_models_returns_none_without_api_key():
    """Test that None is returned when MINIMAX_API_KEY is not available."""
    with patch(
        "genai_core.model_providers.direct.provider.genai_core.parameters.get_external_api_key"
    ) as mock_get_key:
        mock_get_key.return_value = None
        models = _list_minimax_models()
        assert models is None


def test_list_minimax_models_contains_expected_model_names():
    """Test that all expected MiniMax model names are present."""
    with patch(
        "genai_core.model_providers.direct.provider.genai_core.parameters.get_external_api_key"
    ) as mock_get_key:
        mock_get_key.return_value = "test-key"
        models = _list_minimax_models()

        model_names = [m["name"] for m in models]
        assert "MiniMax-M2.7" in model_names
        assert "MiniMax-M2.5" in model_names
        assert "MiniMax-M2.5-highspeed" in model_names


def test_minimax_provider_enum():
    """Test that MINIMAX is a valid Provider enum value."""
    assert Provider.MINIMAX.value == "minimax"
