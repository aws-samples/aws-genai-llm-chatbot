"""
Simplified Nexus Gateway client that handles authentication transparently.
"""

import logging
import time
from functools import lru_cache
from typing import Any, Optional, Union

import requests

from ... import parameters
from .types import (
    ApiError,
    ListApplicationModelsResponse,
    ModelResponse,
    NexusGatewayConfig,
)

logger = logging.getLogger(__name__)


class NexusGatewayClient:
    """Client for interacting with the Nexus Gateway API with simplified auth"""

    def __init__(self, config: Union[dict[str, Any], NexusGatewayConfig]):
        """
        Initialize the Nexus Gateway client

        Args:
            config: Configuration dictionary or NexusGatewayConfig object
        """
        # Convert dictionary to config object if needed
        if isinstance(config, dict):
            self.config = NexusGatewayConfig.from_dict(config)
        else:
            self.config = config

        # Token cache
        self._access_token = None
        self._token_expiry = 0

        # Validate configuration
        if not self.config.gateway_url:
            logger.error("Nexus Gateway URL not configured")
            raise ValueError("Nexus Gateway URL is required but not configured")
        if not self.config.client_id or not self.config.client_secret:
            logger.error("Missing client credentials for Nexus Gateway")
            raise ValueError(
                "Client ID and Client Secret are required for Nexus Gateway auth"
            )
        if not self.config.token_url:
            logger.error("Token URL not configured for Nexus Gateway")
            raise ValueError("Token URL is required for Nexus Gateway auth")

    def list_application_models(self) -> list[ModelResponse]:
        """
        List models available for the application

        Returns:
            List of model information objects
        """
        response = self._make_request("GET", "application/models")

        if isinstance(response, ApiError):
            logger.error(
                f"Error fetching models: {response.error_type}: {response.message}"
            )
            return []

        if "models" in response:
            # Parse the response into a typed object
            typed_response = ListApplicationModelsResponse.from_dict(response)
            return typed_response.models
        else:
            logger.warning(
                "Unexpected response format from application/models endpoint"
            )
            return []

    def invoke_bedrock_converse(
        self, model_id: str, body: dict[str, Any]
    ) -> Union[dict[str, Any], ApiError]:
        """
        Invoke the bedrock converse model with the given body

        Args:
            model_id: The model ID to invoke
            body: The request body

        Returns:
            The model response or an ApiError
        """
        return self._make_request(
            "POST", f"bedrock/model/{model_id}/converse", json_data=body
        )

    def invoke_bedrock_converse_stream(
        self, model_id: str, body: dict[str, Any]
    ) -> Union[dict[str, Any], ApiError]:
        """
        Invoke the bedrock converse model with streaming response

        Args:
            model_id: The model ID to invoke
            body: The request body

        Returns:
            The streaming model response or an ApiError
        """
        return self._make_request(
            "POST",
            f"bedrock/model/{model_id}/converse-stream",
            json_data=body,
            stream=True,
        )

    def _make_request(
        self,
        method: str,
        path: str,
        params: Optional[dict[str, Any]] = None,
        json_data: Optional[dict[str, Any]] = None,
        headers: Optional[dict[str, str]] = None,
        stream: bool = False,
    ) -> Union[dict[str, Any], ApiError]:
        """
        Make a request to the Nexus Gateway API with automatic authentication

        Args:
            method: HTTP method (GET, POST, etc.)
            path: API path (without leading slash)
            params: Query parameters
            json_data: JSON body data
            headers: Additional headers to include

        Returns:
            API response as dictionary or ApiError
        """
        if not self.config.gateway_url:
            error_msg = "Gateway URL not configured"
            logger.error(error_msg)
            return ApiError(error_type="ConfigurationError", message=error_msg)

        url = f"{self.config.gateway_url}/{path}"

        # Prepare headers with authentication
        request_headers = headers.copy() if headers else {}

        # Set Content-Type if not provided
        if "Content-Type" not in request_headers:
            request_headers["Content-Type"] = "application/json"

        # Use client credentials
        token = self._ensure_valid_token()
        if token:
            request_headers["authorization-token"] = f"Bearer {token}"
            request_headers["Authorization"] = f"Bearer {token}"
        else:
            logger.error("Failed to get access token for Nexus Gateway")
            return ApiError(
                error_type="AuthenticationError", message="Failed to get access token"
            )

        try:
            logger.debug(f"Making {method} request to {url}")
            logger.debug(f"Headers: {request_headers}")

            response = requests.request(
                method=method,
                url=url,
                params=params,
                json=json_data,
                headers=request_headers,
                timeout=30,
                stream=stream,
            )

            if response.status_code >= 400:
                error_message = self._get_user_friendly_error_message(
                    response.status_code, response.text
                )
                logger.error(
                    f"API request failed: {response.status_code} {response.text}"
                )
                return ApiError(
                    error_type=f"HTTP {response.status_code}",
                    message=error_message,
                    status_code=response.status_code,
                )

            # Handle streaming responses
            if stream:
                return {"stream": response}

            return response.json()

        except requests.RequestException as e:
            logger.exception(f"Request error: {e!s}")
            return ApiError(error_type="RequestError", message=str(e))
        except ValueError as e:
            logger.exception(f"JSON parsing error: {e!s}")
            return ApiError(error_type="ResponseParsingError", message=str(e))
        except Exception as e:
            logger.exception(f"Unexpected error: {e!s}")
            return ApiError(error_type="UnexpectedError", message=str(e))

    def _ensure_valid_token(self) -> Optional[str]:
        """
        Ensure we have a valid access token, refreshing if necessary

        Returns:
            Valid access token or None if unable to obtain one
        """
        current_time = time.time()

        # If token is expired or not set, get a new one
        if not self._access_token or current_time >= self._token_expiry:
            logger.info("Nexus access token is expired or not set, obtaining a new one")
            return self._get_client_credentials_token()

        return self._access_token

    def _get_client_credentials_token(self) -> Optional[str]:
        """
        Get an OAuth token using client credentials flow

        Returns:
            Access token string or None if unable to obtain one
        """
        if (
            not self.config.token_url
            or not self.config.client_id
            or not self.config.client_secret
        ):
            logger.error("Missing token URL or client credentials")
            return None

        logger.debug(f"Getting client credentials token from {self.config.token_url}")

        headers = {"Content-Type": "application/x-www-form-urlencoded"}

        # Create form data manually to ensure no scope parameter is included
        form_data = (
            f"grant_type=client_credentials&client_id={self.config.client_id}"
            f"&client_secret={self.config.client_secret}"
        )

        try:
            response = requests.post(
                self.config.token_url, data=form_data, headers=headers, timeout=30
            )

            if response.status_code != 200:
                logger.error(
                    f"Token request failed: {response.status_code} {response.text}"
                )
                return None

            data = response.json()
            if "access_token" not in data:
                logger.error(f"No access token in response: {data}")
                return None

            # Store the token and set expiry time (default to 1 hour if not provided)
            self._access_token = data["access_token"]
            expires_in = data.get("expires_in", 3600)
            self._token_expiry = (
                time.time() + expires_in - 60
            )  # Refresh 1 minute before expiry

            logger.info("Successfully obtained access token")
            return self._access_token

        except requests.RequestException:
            logger.exception("Failed to get client credentials token: Request error")
            return None
        except ValueError:
            logger.exception(
                "Failed to get client credentials token: Invalid response format"
            )
            return None
        except Exception:
            logger.exception("Failed to get client credentials token: Unexpected error")
            return None

    def _get_user_friendly_error_message(
        self, status_code: int, response_text: str
    ) -> str:
        """Convert Gateway error responses to user-friendly messages."""
        if status_code == 429:
            return (
                "I'm currently experiencing high demand. "
                "Please wait a moment and try again."
            )
        elif status_code == 401:
            return "Authentication failed. Please contact your administrator."
        elif status_code == 403:
            return "Access denied. You may not have permission to use " "this model."
        elif status_code == 404:
            return (
                "The requested model is not available. " "Please try a different model."
            )
        elif status_code == 500:
            return (
                "The service is temporarily unavailable. "
                "Please try again in a few moments."
            )
        elif "token" in response_text.lower() and (
            "limit" in response_text.lower() or "quota" in response_text.lower()
        ):
            return (
                "Token limit exceeded. Please try a shorter message or "
                "contact your administrator."
            )
        else:
            return (
                "I apologize, but I encountered an error while processing "
                "your request. Please try again."
            )

    def get_access_token(self, force_refresh: bool = False) -> Optional[str]:
        """
        Get an OAuth access token for use with the Nexus Gateway

        Args:
            force_refresh: Force refresh the token even if cached

        Returns:
            Access token string or None if not available
        """
        if force_refresh:
            return self._get_client_credentials_token()
        return self._ensure_valid_token()


@lru_cache(maxsize=1)
def get_nexus_gateway_client() -> Optional[NexusGatewayClient]:
    config = parameters.get_config()
    nexus_config = config.get("nexus", {})
    if not nexus_config.get("enabled", False):
        return None
    return NexusGatewayClient(nexus_config)
