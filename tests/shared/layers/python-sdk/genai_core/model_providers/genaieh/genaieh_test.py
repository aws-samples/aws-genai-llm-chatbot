from unittest.mock import MagicMock, patch

import genai_core.model_providers.genaieh.genaieh as genaieh
import pytest


@pytest.fixture
def mock_config():
    return {
        "genaieh": {
            "enabled": True,
            "gatewayUrl": "https://genaieh-gateway.example.com",
            "clientId": "test-client-id",
            "clientSecret": "test-client-secret",
            "tokenUrl": "https://genaieh-auth.example.com/token",
        }
    }


@pytest.fixture
def mock_genaieh_models():
    return [
        {
            "modelName": "claude-3-sonnet",
            "modelProvider": {
                "modelProviderName": "anthropic",
                "model": "claude-3-sonnet",
            },
            "mode": "chat",
        },
        {
            "modelName": "claude-3-haiku",
            "modelProvider": {
                "modelProviderName": "anthropic",
                "model": "claude-3-haiku",
            },
            "mode": "chat",
        },
        {
            "modelName": "titan-embed",
            "modelProvider": {
                "modelProviderName": "bedrock",
                "model": "amazon.titan-embed-text-v1",
            },
            "mode": "embedding",
        },
    ]


def test_genaieh_client_initialization(mock_config):
    """Test that _genaieh_client initializes correctly"""
    with patch("genai_core.parameters.get_config") as mock_get_config:
        mock_get_config.return_value = mock_config

        # Call the cached function
        client = genaieh._genaieh_client()

        # Verify client was created with correct config
        assert client is not None


def test_list_models(mock_config, mock_genaieh_models):
    """Test that list_models returns transformed models from the client"""
    # Set up mocks for config and client
    with (
        patch("genai_core.parameters.get_config") as mock_get_config,
        patch(
            "genai_core.model_providers.genaieh.genaieh._genaieh_client"
        ) as mock_func,
    ):
        # Configure the mock client to return test models
        mock_client = MagicMock()
        mock_client.list_application_models.return_value = mock_genaieh_models
        mock_func.return_value = mock_client
        mock_get_config.return_value = mock_config

        # Create provider and call list_models
        provider = genaieh.GenAIEHModelProvider()
        models = provider.list_models()

        # Verify client was called
        mock_client.list_application_models.assert_called_once()

        # Verify models were transformed correctly
        assert len(models) == len(mock_genaieh_models)

        # Check first model (chat model)
        assert models[0]["name"] == "claude-3-sonnet"
        assert models[0]["provider"] == "genaieh.anthropic"
        assert models[0]["ragSupported"] == False
        assert models[0]["streaming"]
        assert models[0]["inputModalities"] == ["text"]
        assert models[0]["outputModalities"] == ["text"]

        # Check embedding model
        embedding_model = next(m for m in models if m["name"] == "titan-embed")
        assert embedding_model["provider"] == "genaieh.bedrock"
        assert not embedding_model["ragSupported"]
        assert not embedding_model["streaming"]
        assert embedding_model["inputModalities"] == ["text"]
        assert embedding_model["outputModalities"] == []


def test_list_models_error_handling(mock_config):
    """Test that list_models handles errors gracefully"""
    # Set up mocks for config and client
    with (
        patch("genai_core.parameters.get_config") as mock_get_config,
        patch(
            "genai_core.model_providers.genaieh.genaieh._genaieh_client"
        ) as mock_func,
    ):
        # Configure the mock client to raise an exception
        mock_client = MagicMock()
        mock_client.list_application_models.side_effect = Exception("API error")
        mock_func.return_value = mock_client
        mock_get_config.return_value = mock_config

        # Create provider and call list_models
        provider = genaieh.GenAIEHModelProvider()
        models = provider.list_models()

        # Verify client was called
        mock_client.list_application_models.assert_called_once()

        # Verify empty list is returned on error
        assert models == []


def test_get_model_modalities(mock_config, mock_genaieh_models):
    """Test that get_model_modalities returns correct modalities"""
    # Set up mocks for config and client
    with (
        patch("genai_core.parameters.get_config") as mock_get_config,
        patch(
            "genai_core.model_providers.genaieh.genaieh._genaieh_client"
        ) as mock_func,
    ):
        # Configure the mock client to return test models
        mock_client = MagicMock()
        mock_client.list_application_models.return_value = mock_genaieh_models
        mock_func.return_value = mock_client
        mock_get_config.return_value = mock_config

        # Create provider
        provider = genaieh.GenAIEHModelProvider()

        # Need to patch the list_models method to return transformed models
        with patch.object(provider, "list_models") as mock_list_models:
            # Set up the mock to return transformed models
            transformed_models = [
                genaieh._transform_genaieh_model(m) for m in mock_genaieh_models
            ]
            mock_list_models.return_value = transformed_models

            # Test with existing model
            modalities = provider.get_model_modalities("claude-3-sonnet")
            assert modalities == ["text"]

            # Test with non-existent model
            modalities = provider.get_model_modalities("non-existent-model")
            assert modalities == []


def test_transform_genaieh_model():
    """Test that _transform_genaieh_model correctly transforms model data"""
    # Test chat model
    chat_model = {
        "modelName": "claude-3-sonnet",
        "modelProvider": {"modelProviderName": "anthropic", "model": "claude-3-sonnet"},
        "mode": "chat",
    }

    transformed = genaieh._transform_genaieh_model(chat_model)

    assert transformed["name"] == "claude-3-sonnet"
    assert transformed["provider"] == "genaieh.anthropic"
    assert transformed["providerModelName"] == "claude-3-sonnet"
    assert transformed["ragSupported"] == False
    assert transformed["streaming"]
    assert transformed["inputModalities"] == ["text"]
    assert transformed["outputModalities"] == ["text"]

    # Test embedding model
    embedding_model = {
        "modelName": "titan-embed",
        "modelProvider": {
            "modelProviderName": "bedrock",
            "model": "amazon.titan-embed-text-v1",
        },
        "mode": "embedding",
    }

    transformed = genaieh._transform_genaieh_model(embedding_model)

    assert transformed["name"] == "titan-embed"
    assert transformed["provider"] == "genaieh.bedrock"
    assert transformed["providerModelName"] == "amazon.titan-embed-text-v1"
    assert not transformed["ragSupported"]
    assert not transformed["streaming"]
    assert transformed["inputModalities"] == ["text"]
    assert transformed["outputModalities"] == []

    # Test model with missing fields
    incomplete_model = {"modelProvider": {}}

    transformed = genaieh._transform_genaieh_model(incomplete_model)

    assert transformed["name"] == "Unknown Model"
    assert transformed["provider"] == "genaieh"
