from unittest.mock import MagicMock, patch

import genai_core.model_providers.nexus.nexus as nexus
import pytest


@pytest.fixture
def mock_config():
    return {
        "nexus": {
            "enabled": True,
            "gatewayUrl": "https://nexus-gateway.example.com",
            "clientId": "test-client-id",
            "clientSecret": "test-client-secret",
            "tokenUrl": "https://nexus-auth.example.com/token",
        }
    }


@pytest.fixture
def mock_nexus_models():
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


def test_nexus_client_initialization(mock_config):
    """Test that _nexus_client initializes correctly"""
    with patch("genai_core.parameters.get_config") as mock_get_config:
        mock_get_config.return_value = mock_config

        # Call the cached function
        client = nexus._nexus_client()

        # Verify client was created with correct config
        assert client is not None


def test_list_models(mock_config, mock_nexus_models):
    """Test that list_models returns transformed models from the client"""
    # Set up mocks for config and client
    with (
        patch("genai_core.parameters.get_config") as mock_get_config,
        patch("genai_core.model_providers.nexus.nexus._nexus_client") as mock_func,
    ):
        # Configure the mock client to return test models
        mock_client = MagicMock()
        mock_client.list_application_models.return_value = mock_nexus_models
        mock_func.return_value = mock_client
        mock_get_config.return_value = mock_config

        # Create provider and call list_models
        provider = nexus.NexusModelProvider()
        models = provider.list_models()

        # Verify client was called
        mock_client.list_application_models.assert_called_once()

        # Verify models were transformed correctly
        assert len(models) == len(mock_nexus_models)

        # Check first model (chat model)
        assert models[0]["name"] == "claude-3-sonnet"
        assert models[0]["provider"] == "anthropic"
        assert models[0]["ragSupported"]
        assert models[0]["streaming"]
        assert models[0]["inputModalities"] == ["text"]
        assert models[0]["outputModalities"] == ["text"]

        # Check embedding model
        embedding_model = next(m for m in models if m["name"] == "titan-embed")
        assert embedding_model["provider"] == "bedrock"
        assert not embedding_model["ragSupported"]
        assert not embedding_model["streaming"]
        assert embedding_model["inputModalities"] == ["text"]
        assert embedding_model["outputModalities"] == []


def test_list_models_error_handling(mock_config):
    """Test that list_models handles errors gracefully"""
    # Set up mocks for config and client
    with (
        patch("genai_core.parameters.get_config") as mock_get_config,
        patch("genai_core.model_providers.nexus.nexus._nexus_client") as mock_func,
    ):
        # Configure the mock client to raise an exception
        mock_client = MagicMock()
        mock_client.list_application_models.side_effect = Exception("API error")
        mock_func.return_value = mock_client
        mock_get_config.return_value = mock_config

        # Create provider and call list_models
        provider = nexus.NexusModelProvider()
        models = provider.list_models()

        # Verify client was called
        mock_client.list_application_models.assert_called_once()

        # Verify empty list is returned on error
        assert models == []


def test_get_model_modalities(mock_config, mock_nexus_models):
    """Test that get_model_modalities returns correct modalities"""
    # Set up mocks for config and client
    with (
        patch("genai_core.parameters.get_config") as mock_get_config,
        patch("genai_core.model_providers.nexus.nexus._nexus_client") as mock_func,
    ):
        # Configure the mock client to return test models
        mock_client = MagicMock()
        mock_client.list_application_models.return_value = mock_nexus_models
        mock_func.return_value = mock_client
        mock_get_config.return_value = mock_config

        # Create provider
        provider = nexus.NexusModelProvider()

        # Need to patch the list_models method to return transformed models
        with patch.object(provider, "list_models") as mock_list_models:
            # Set up the mock to return transformed models
            transformed_models = [
                nexus._transform_nexus_model(m) for m in mock_nexus_models
            ]
            mock_list_models.return_value = transformed_models

            # Test with existing model
            modalities = provider.get_model_modalities("claude-3-sonnet")
            assert modalities == ["text"]

            # Test with non-existent model
            modalities = provider.get_model_modalities("non-existent-model")
            assert modalities == []


def test_transform_nexus_model():
    """Test that _transform_nexus_model correctly transforms model data"""
    # Test chat model
    chat_model = {
        "modelName": "claude-3-sonnet",
        "modelProvider": {"modelProviderName": "anthropic", "model": "claude-3-sonnet"},
        "mode": "chat",
    }

    transformed = nexus._transform_nexus_model(chat_model)

    assert transformed["name"] == "claude-3-sonnet"
    assert transformed["provider"] == "anthropic"
    assert transformed["providerModelName"] == "claude-3-sonnet"
    assert transformed["ragSupported"]
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

    transformed = nexus._transform_nexus_model(embedding_model)

    assert transformed["name"] == "titan-embed"
    assert transformed["provider"] == "bedrock"
    assert transformed["providerModelName"] == "amazon.titan-embed-text-v1"
    assert not transformed["ragSupported"]
    assert not transformed["streaming"]
    assert transformed["inputModalities"] == ["text"]
    assert transformed["outputModalities"] == []

    # Test model with missing fields
    incomplete_model = {"modelProvider": {}}

    transformed = nexus._transform_nexus_model(incomplete_model)

    assert transformed["name"] == "Unknown Model"
    assert transformed["provider"] == "Unknown Provider"
