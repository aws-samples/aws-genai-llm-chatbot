import time
from unittest.mock import MagicMock, patch

import pytest
import requests
from genai_core.model_providers.nexus.nexus_client import NexusGatewayClient
from genai_core.model_providers.nexus.types import (
    ApiError,
    ModelResponse,
    NexusGatewayConfig,
)


@pytest.fixture
def mock_config():
    return {
        "enabled": True,
        "gatewayUrl": "https://nexus-gateway.example.com",
        "clientId": "test-client-id",
        "clientSecret": "test-client-secret",
        "tokenUrl": "https://nexus-auth.example.com/token",
    }


@pytest.fixture
def mock_token_response():
    return {
        "access_token": "test-access-token",
        "token_type": "Bearer",
        "expires_in": 3600,
    }


@pytest.fixture
def mock_models_response():
    return [
        {
            "modelId": "uuid1",
            "modelName": "claude1",
            "modelProvider": {
                "modelProviderName": "anthropic",
                "model": "claude-3-sonnet",
            },
            "mode": "chat",
        },
        {
            "modelId": "uuid2",
            "modelName": "claude2",
            "modelProvider": {
                "modelProviderName": "anthropic",
                "model": "claude-3-haiku",
            },
            "mode": "chat",
        },
    ]


def test_client_initialization(mock_config):
    """Test that NexusGatewayClient initializes correctly"""
    client = NexusGatewayClient(mock_config)

    assert client.config.gateway_url == "https://nexus-gateway.example.com"
    assert client.config.client_id == "test-client-id"
    assert client.config.client_secret == "test-client-secret"
    assert client.config.token_url == "https://nexus-auth.example.com/token"
    assert client._access_token is None
    assert client._token_expiry == 0


def test_client_initialization_with_trailing_slash(mock_config):
    """Test that trailing slash is removed from gateway URL"""
    mock_config["gatewayUrl"] = "https://nexus-gateway.example.com/"
    client = NexusGatewayClient(mock_config)

    assert client.config.gateway_url == "https://nexus-gateway.example.com"


def test_client_initialization_with_missing_config():
    """Test that client handles missing configuration gracefully"""
    error_msg = "Nexus Gateway URL is required but not configured"
    with pytest.raises(ValueError, match=error_msg):
        NexusGatewayClient({})


def test_client_initialization_with_config_object():
    """Test that client can be initialized with a NexusGatewayConfig object"""
    config = NexusGatewayConfig(
        gateway_url="https://nexus-gateway.example.com",
        client_id="test-client-id",
        client_secret="test-client-secret",
        token_url="https://nexus-auth.example.com/token",
        enabled=True,
    )
    client = NexusGatewayClient(config)

    assert client.config.gateway_url == "https://nexus-gateway.example.com"
    assert client.config.client_id == "test-client-id"
    assert client.config.client_secret == "test-client-secret"
    assert client.config.token_url == "https://nexus-auth.example.com/token"
    assert client.config.enabled is True


def test_get_access_token(mock_config, mock_token_response):
    """Test that get_access_token fetches and caches token"""
    with patch("requests.post") as mock_post:
        # Configure mock response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = mock_token_response
        mock_post.return_value = mock_response

        client = NexusGatewayClient(mock_config)

        # First call should fetch token
        token = client.get_access_token()

        assert token == "test-access-token"
        assert client._access_token == "test-access-token"
        assert client._token_expiry > time.time()

        mock_post.assert_called_once()

        # Second call should use cached token
        token = client.get_access_token()

        assert token == "test-access-token"
        mock_post.assert_called_once()  # Still only called once


def test_get_access_token_force_refresh(mock_config, mock_token_response):
    """Test that get_access_token with force_refresh gets a new token"""
    with patch("requests.post") as mock_post:
        # Configure mock response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = mock_token_response
        mock_post.return_value = mock_response

        client = NexusGatewayClient(mock_config)

        # First call should fetch token
        token = client.get_access_token()

        assert token == "test-access-token"
        mock_post.assert_called_once()

        # Force refresh should fetch new token
        token = client.get_access_token(force_refresh=True)

        assert token == "test-access-token"
        assert mock_post.call_count == 2


def test_get_access_token_error(mock_config):
    """Test that get_access_token handles errors gracefully"""
    with patch("requests.post") as mock_post:
        # Configure mock response for error
        mock_post.side_effect = requests.exceptions.RequestException("Connection error")

        client = NexusGatewayClient(mock_config)

        # Call should return None on error
        token = client.get_access_token()

        assert token is None
        mock_post.assert_called_once()


def test_get_access_token_invalid_response(mock_config):
    """Test that get_access_token handles invalid responses"""
    with patch("requests.post") as mock_post:
        # Configure mock response with missing token
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"token_type": "Bearer"}  # No access_token
        mock_post.return_value = mock_response

        client = NexusGatewayClient(mock_config)

        # Call should return None on invalid response
        token = client.get_access_token()

        assert token is None
        mock_post.assert_called_once()


def test_list_models(mock_config, mock_token_response, mock_models_response):
    """Test that list_application_models returns models from API"""
    with (
        patch("requests.post") as mock_token_post,
        patch("requests.request") as mock_request,
    ):
        # Configure token response
        token_response = MagicMock()
        token_response.status_code = 200
        token_response.json.return_value = mock_token_response
        mock_token_post.return_value = token_response

        # Configure models response
        models_response = MagicMock()
        models_response.status_code = 200
        models_response.json.return_value = {"models": mock_models_response}
        mock_request.return_value = models_response

        client = NexusGatewayClient(mock_config)

        # Call list_application_models
        models = client.list_application_models()

        mock_request.assert_called_once()
        mock_token_post.assert_called_once()

        # Verify models were returned and are of the correct type
        assert len(models) == 2
        assert all(isinstance(model, ModelResponse) for model in models)
        assert models[0].model_id == "uuid1"
        assert models[0].model_name == "claude1"
        assert models[0].model_provider.model_provider_name == "anthropic"
        assert models[0].model_provider.model == "claude-3-sonnet"
        assert models[0].mode == "chat"


def test_list_application_models_error(mock_config, mock_token_response):
    """Test that list_application_models handles errors gracefully"""
    with (
        patch("requests.post") as mock_token_post,
        patch("requests.request") as mock_request,
    ):
        # Configure token response
        token_response = MagicMock()
        token_response.status_code = 200
        token_response.json.return_value = mock_token_response
        mock_token_post.return_value = token_response

        # Configure models response for error
        mock_request.side_effect = requests.exceptions.RequestException("API error")

        client = NexusGatewayClient(mock_config)

        # Call should return empty list on error
        models = client.list_application_models()

        assert models == []
        mock_token_post.assert_called_once()
        mock_request.assert_called_once()


def test_make_request_success(mock_config, mock_token_response):
    """Test that _make_request successfully makes API requests"""
    with (
        patch("requests.post") as mock_token_post,
        patch("requests.request") as mock_request,
    ):
        # Configure token response
        token_response = MagicMock()
        token_response.status_code = 200
        token_response.json.return_value = mock_token_response
        mock_token_post.return_value = token_response

        # Configure request response
        request_response = MagicMock()
        request_response.status_code = 200
        request_response.json.return_value = {"data": "result"}
        mock_request.return_value = request_response

        client = NexusGatewayClient(mock_config)

        # Make request
        result = client._make_request("GET", "test/endpoint")

        assert result == {"data": "result"}
        mock_request.assert_called_once()

        # Verify headers
        headers = mock_request.call_args[1]["headers"]
        assert headers["Authorization"] == "Bearer test-access-token"
        assert headers["Content-Type"] == "application/json"


def test_make_request_error(mock_config, mock_token_response):
    """Test that _make_request handles errors gracefully"""
    with (
        patch("requests.post") as mock_token_post,
        patch("requests.request") as mock_request,
    ):
        # Configure token response
        token_response = MagicMock()
        token_response.status_code = 200
        token_response.json.return_value = mock_token_response
        mock_token_post.return_value = token_response

        # Configure request error
        mock_request.side_effect = requests.exceptions.RequestException("API error")

        client = NexusGatewayClient(mock_config)

        # Make request
        result = client._make_request("GET", "test/endpoint")

        assert isinstance(result, ApiError)
        assert result.error_type == "RequestError"
        assert "API error" in result.message
        mock_request.assert_called_once()


def test_make_request_http_error(mock_config, mock_token_response):
    """Test that _make_request handles HTTP errors gracefully"""
    with (
        patch("requests.post") as mock_token_post,
        patch("requests.request") as mock_request,
    ):
        # Configure token response
        token_response = MagicMock()
        token_response.status_code = 200
        token_response.json.return_value = mock_token_response
        mock_token_post.return_value = token_response

        # Configure request HTTP error
        error_response = MagicMock()
        error_response.status_code = 404
        error_response.text = "Not Found"
        mock_request.return_value = error_response

        client = NexusGatewayClient(mock_config)

        # Make request
        result = client._make_request("GET", "test/endpoint")

        assert isinstance(result, ApiError)
        assert result.error_type == "HTTP 404"
        assert result.message == "Not Found"
        assert result.status_code == 404
        mock_request.assert_called_once()
