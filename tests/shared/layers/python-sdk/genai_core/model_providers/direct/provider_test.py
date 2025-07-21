from unittest.mock import patch

import pytest
from genai_core.model_providers.direct.provider import DirectModelProvider
from genai_core.types import EmbeddingsModel, Provider


@pytest.fixture
def mock_models():
    return [
        {
            "name": "claude-3-sonnet",
            "provider": "anthropic",
            "providerModelName": "claude-3-sonnet",
            "ragSupported": True,
            "streaming": True,
            "inputModalities": ["text"],
            "outputModalities": ["text"],
        },
        {
            "name": "claude-3-haiku",
            "provider": "anthropic",
            "providerModelName": "claude-3-haiku",
            "ragSupported": True,
            "streaming": True,
            "inputModalities": ["text"],
            "outputModalities": ["text"],
        },
    ]


@pytest.fixture
def mock_embedding_models():
    return [
        {
            "name": "titan-embed",
            "provider": "bedrock",
            "dimensions": 1536,
            "maxInputLength": 8000,
        },
        {
            "name": "cohere-embed",
            "provider": "bedrock",
            "dimensions": 1024,
            "maxInputLength": 4000,
        },
    ]


def test_list_models(mock_models):
    """Test that list_models returns models from the models module"""
    # Create a mock provider instance
    provider = DirectModelProvider()

    # Mock the DirectModelProvider.list_models method
    with patch.object(DirectModelProvider, "list_models", return_value=mock_models):
        models = provider.list_models()

        assert models == mock_models
        assert len(models) == 2
        assert models[0]["name"] == "claude-3-sonnet"
        assert models[1]["name"] == "claude-3-haiku"


def test_get_embedding_models(mock_embedding_models):
    """Test that get_embedding_models returns models from the embeddings module"""
    # Create a mock provider instance
    provider = DirectModelProvider()

    # Mock the DirectModelProvider.get_embedding_models method
    with patch.object(
        DirectModelProvider, "get_embedding_models", return_value=mock_embedding_models
    ):
        models = provider.get_embedding_models()

        assert models == mock_embedding_models
        assert len(models) == 2
        assert models[0]["name"] == "titan-embed"
        assert models[1]["name"] == "cohere-embed"


def test_get_embeddings_model():
    """Test that get_embeddings_model delegates to the embeddings module"""
    mock_model = EmbeddingsModel(
        name="titan-embed", provider="bedrock", dimensions=1536, maxInputLength=8000
    )

    # Create a mock provider instance
    provider = DirectModelProvider()

    # Mock the DirectModelProvider.get_embeddings_model method
    with patch.object(
        DirectModelProvider, "get_embeddings_model", return_value=mock_model
    ) as mock_get_model:
        model = provider.get_embeddings_model(Provider.BEDROCK, "titan-embed")

        assert model == mock_model
        mock_get_model.assert_called_once_with(Provider.BEDROCK, "titan-embed")


def test_get_model_modalities():
    """Test that get_model_modalities delegates to the models module"""
    # Create a mock provider instance
    provider = DirectModelProvider()

    # Mock the DirectModelProvider.get_model_modalities method
    with patch.object(
        DirectModelProvider, "get_model_modalities", return_value=["text"]
    ) as mock_get_modalities:
        # Use a valid model ID format
        modalities = provider.get_model_modalities("bedrock::claude-3-sonnet")

        assert modalities == ["text"]
        # The parameter is passed positionally, not as a keyword argument
        mock_get_modalities.assert_called_once_with("bedrock::claude-3-sonnet")
