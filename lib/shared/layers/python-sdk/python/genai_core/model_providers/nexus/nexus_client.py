"""
Simplified Nexus Gateway client that handles authentication transparently.
"""

import logging
import time
from functools import lru_cache
from typing import Any, Optional, Union

import requests
import aiohttp

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

    def invoke_openai_chat(
        self, body: dict[str, Any], streaming: bool = False
    ) -> Union[dict[str, Any], ApiError]:
        """
        Invoke the openai chat with the given body

        Args:
            body: The request body

        Returns:
            The model response or an ApiError
        """
        return self._make_request(
            "POST",
            "openai-proxy/v1/chat/completions",
            json_data=body,
            stream=streaming,
        )

    def invoke_openai_stream_chat(
        self, body: dict[str, Any]
    ) -> Union[dict[str, Any], ApiError]:
        """
        Invoke the openai chat with the given body asynchronously

        Args:
            body: The request body
            streaming: Whether to stream the response

        Returns:
            The model response or an ApiError
        """
        import asyncio

        return asyncio.run(
            self._make_async_request(
                "POST", "openai-proxy/v1/chat/completions", json_data=body
            )
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
        """Make a request to the Nexus Gateway API with automatic authentication"""
        try:
            url, request_headers = self._prepare_request(path, headers)
            logger.debug(f"Making {method} request to {url}")

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
                return self._handle_error_response(response.status_code, response.text)

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

    async def _make_async_request(
        self,
        method: str,
        path: str,
        params: Optional[dict[str, Any]] = None,
        json_data: Optional[dict[str, Any]] = None,
        headers: Optional[dict[str, str]] = None,
    ) -> Union[dict[str, Any], ApiError]:
        """
        Make an async request to the Nexus Gateway API with automatic authentication
        Used for OpenAI streaming requests
        """
        try:
            url, request_headers = self._prepare_request(path, headers)
            logger.debug(f"Making async {method} request to {url}")

            async with aiohttp.ClientSession() as session:
                async with session.request(
                    method=method,
                    url=url,
                    params=params,
                    json=json_data,
                    headers=request_headers,
                    timeout=aiohttp.ClientTimeout(total=30),
                ) as response:

                    if response.status >= 400:
                        response_text = await response.text()
                        return self._handle_error_response(
                            response.status, response_text
                        )

                    content = await response.read()
                    return self._process_openai_stream(content)

        except aiohttp.ClientError as e:
            logger.exception(f"Async request error: {e!s}")
            return ApiError(error_type="RequestError", message=str(e))
        except ValueError as e:
            logger.exception(f"JSON parsing error: {e!s}")
            return ApiError(error_type="ResponseParsingError", message=str(e))
        except Exception as e:
            logger.exception(f"Unexpected error: {e!s}")
            return ApiError(error_type="UnexpectedError", message=str(e))

    def _prepare_request(
        self, path: str, headers: Optional[dict[str, str]] = None
    ) -> tuple[str, dict[str, str]]:
        """Prepare URL and headers for request"""
        if not self.config.gateway_url:
            raise ValueError("Gateway URL not configured")

        url = f"{self.config.gateway_url}/{path}"
        request_headers = headers.copy() if headers else {}

        if "Content-Type" not in request_headers:
            request_headers["Content-Type"] = "application/json"

        token = self._ensure_valid_token()
        if not token:
            raise ValueError("Failed to get access token")

        request_headers["authorization-token"] = f"Bearer {token}"
        request_headers["Authorization"] = f"Bearer {token}"

        return url, request_headers

    def _process_openai_stream(self, content: bytes) -> dict[str, Any]:
        """Process OpenAI streaming response"""
        chunks = []
        for line in content.decode("utf-8").split("\n"):
            line = line.strip()
            if line.startswith("data: "):
                data_str = line[6:]
                if data_str == "[DONE]":
                    break
                try:
                    import json

                    chunk_data = json.loads(data_str)
                    if "choices" in chunk_data and len(chunk_data["choices"]) > 0:
                        delta = chunk_data["choices"][0].get("delta", {})
                        if "content" in delta:
                            chunks.append(delta["content"])
                except json.JSONDecodeError:
                    continue
        return {"chunks": chunks, "stream": True}

    def _handle_error_response(self, status_code: int, response_text: str) -> ApiError:
        """Handle error response and return ApiError"""
        error_message = self._get_user_friendly_error_message(
            status_code, response_text
        )
        logger.error(f"API request failed: {status_code} {response_text}")
        return ApiError(
            error_type=f"HTTP {status_code}",
            message=error_message,
            status_code=status_code,
        )

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
