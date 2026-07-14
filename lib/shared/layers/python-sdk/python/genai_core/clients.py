import logging
from typing import Any, Optional

import boto3
import openai
from botocore.config import Config

import genai_core.parameters
import genai_core.types

logger = logging.getLogger(__name__)


def get_openai_client() -> Optional[Any]:
    api_key = genai_core.parameters.get_external_api_key("OPENAI_API_KEY")
    if not api_key:
        return None

    openai.api_key = api_key

    return openai


def get_minimax_client() -> Optional[openai.OpenAI]:
    api_key = genai_core.parameters.get_external_api_key("MINIMAX_API_KEY")
    if not api_key:
        return None

    return openai.OpenAI(
        api_key=api_key,
        base_url="https://api.minimax.io/v1",
    )


def get_sagemaker_client() -> Any:
    config = Config(retries={"max_attempts": 15, "mode": "adaptive"})

    client = boto3.client("sagemaker-runtime", config=config)

    return client


# Cache for bedrock-agentcore client (data plane)
_agentcore_client = None

# Cache for bedrock-agentcore-control client (control plane)
_agentcore_control_client = None


def get_agentcore_client() -> Any:
    """
    Get bedrock-agentcore client with caching

    Returns:
        boto3.client: Cached bedrock-agentcore client
    """
    global _agentcore_client
    if _agentcore_client is None:
        config = Config(retries={"max_attempts": 15, "mode": "adaptive"})
        _agentcore_client = boto3.client("bedrock-agentcore", config=config)
    return _agentcore_client


def get_agentcore_control_client() -> Any:
    """
    Get bedrock-agentcore-control client with caching

    Returns:
        boto3.client: Cached bedrock-agentcore-control client
    """
    global _agentcore_control_client
    if _agentcore_control_client is None:
        config = Config(retries={"max_attempts": 15, "mode": "adaptive"})
        _agentcore_control_client = boto3.client(
            "bedrock-agentcore-control", config=config
        )
    return _agentcore_control_client


def get_bedrock_client(service_name: str = "bedrock-runtime") -> Any:
    """
    Get a boto3 client for Bedrock services

    Args:
        service_name: AWS service name (default: "bedrock-runtime")

    Returns:
        boto3 client for the specified Bedrock service
    """
    # For bedrock-runtime, use the special client that might use GenAIEH
    if service_name == "bedrock-runtime":
        return _get_bedrock_runtime_client()

    # For other services (like "bedrock"), use the standard client
    return _get_standard_bedrock_client(service_name)


def is_genaieh_configured() -> tuple[bool, dict[str, str]]:
    """
    Check if GenAIEH Gateway is properly configured

    Returns:
        tuple: (is_configured, config_dict) where is_configured is a boolean and
               config_dict contains the GenAIEH configuration if available
    """
    config = genai_core.parameters.get_config()
    genaieh_config = config.get("genaieh", {})

    # Extract configuration values
    genaieh_enabled = genaieh_config.get("enabled", False)
    genaieh_gateway_url = genaieh_config.get("gatewayUrl")
    genaieh_client_id = genaieh_config.get("clientId")
    genaieh_client_secret = genaieh_config.get("clientSecret")
    genaieh_token_url = genaieh_config.get("tokenUrl")

    # Log the configuration for debugging
    masked_client_id = (
        f"{genaieh_client_id[:5]}... (masked)" if genaieh_client_id else "None"
    )

    logger.debug(
        f"GenAIEH config: enabled={genaieh_enabled}, gatewayUrl={genaieh_gateway_url}, "
        f"clientId={masked_client_id}, tokenUrl={genaieh_token_url}"
    )

    # Check if all required configuration is available
    is_configured = (
        genaieh_enabled
        and genaieh_gateway_url
        and genaieh_client_id
        and genaieh_client_secret
        and genaieh_token_url
    )

    if not is_configured:
        # Log which specific configuration is missing
        if not genaieh_enabled:
            logger.warning("GenAIEH Gateway is not enabled")
        if not genaieh_gateway_url:
            logger.warning("GenAIEH Gateway URL is not configured")
        if not genaieh_client_id:
            logger.warning("GenAIEH client ID is not configured")
        if not genaieh_client_secret:
            logger.warning("GenAIEH client secret is not configured")
        if not genaieh_token_url:
            logger.warning("GenAIEH token URL is not configured")

    if is_configured:
        return True, {
            "gatewayUrl": genaieh_gateway_url,
            "clientId": genaieh_client_id,
            "clientSecret": genaieh_client_secret,
            "tokenUrl": genaieh_token_url,
        }

    return False, {}


def _create_genaieh_boto_client(genaieh_config: dict[str, str]) -> Any:
    """
    Create a boto3 client configured for GenAIEH Gateway

    Args:
        genaieh_config: Dictionary containing GenAIEH Gateway configuration

    Returns:
        boto3.client: Configured boto3 client for GenAIEH Gateway
    """
    # Create config that disables AWS signature
    client_config = Config(signature_version=None)  # Use None instead of "UNSIGNED"

    # Create client with GenAIEH endpoint
    gateway_url = genaieh_config["gatewayUrl"]

    # Add /bedrock prefix to the endpoint URL if it doesn't already have it
    if not gateway_url.endswith("/"):
        gateway_url += "/"

    if not gateway_url.endswith("/bedrock/"):
        if gateway_url.endswith("/"):
            gateway_url += "bedrock"
        else:
            gateway_url += "/bedrock"

    logger.info("Using GenAIEH Gateway URL with bedrock prefix")

    client = boto3.client(
        "bedrock-runtime", endpoint_url=gateway_url, config=client_config
    )

    return client


def _setup_token_handlers(client: Any, genaieh_config: dict[str, str]) -> Any:
    """
    Set up token handling for the GenAIEH Gateway client

    Args:
        client: boto3 client to configure
        genaieh_config: Dictionary containing GenAIEH Gateway configuration

    Returns:
        boto3.client: Configured client with token handlers
    """
    # Import here to avoid circular imports
    from genai_core.model_providers.genaieh.genaieh_client import GenAIEHGatewayClient

    # Create GenAIEH client for token management
    genaieh_client = GenAIEHGatewayClient(genaieh_config)

    # Store token state for lazy loading and caching
    token_state: dict[str, Optional[str]] = {"token": None}

    # Handler for adding token to requests
    def add_token_to_request(request: Any) -> None:
        # Only fetch token when actually making a request
        if not token_state["token"]:
            logger.info("Lazily fetching initial OAuth token for GenAIEH Gateway")
            try:
                token_state["token"] = genaieh_client.get_access_token()
                if not token_state["token"]:
                    logger.error("Failed to get OAuth token for GenAIEH Gateway")
            except Exception as e:
                logger.error(f"Exception while fetching OAuth token: {str(e)}")
                # Continue with no token, likely causing 401 and trigger retry

        # Add the token to the request headers if we have one
        if token_state["token"]:
            # HTTPHeaders doesn't have update method, use direct assignment
            request.headers["Authorization-Token"] = f'Bearer {token_state["token"]}'
        else:
            logger.warning("No valid token available for GenAIEH Gateway request")

    # Handler for refreshing expired tokens
    def refresh_token_on_error(response: Any, **_: Any) -> None:
        # Extract request and response from kwargs
        response = response.get("parsed_response", {})

        # Check if we got an auth error (401)
        if response.get("ResponseMetadata", {}).get("HTTPStatusCode") == 401:
            logger.info("Received 401 unauthorized, refreshing token and retrying")
            # Force refresh the token
            try:
                token_state["token"] = genaieh_client.get_access_token(
                    force_refresh=True
                )
                if not token_state["token"]:
                    logger.error("Failed to refresh OAuth token for GenAIEH Gateway")
            except Exception as e:
                logger.error(f"Exception while refreshing OAuth token: {str(e)}")
                token_state["token"] = (
                    None  # Clear the token to force a fresh attempt next time
                )

        # Log other errors for debugging
        elif response.get("ResponseMetadata", {}).get("HTTPStatusCode", 200) >= 400:
            logger.debug(
                f"Bedrock response error: {response.get('ResponseMetadata', {})}"
            )

    # Register the handlers
    client.meta.events.register("before-sign.bedrock-runtime.*", add_token_to_request)
    client.meta.events.register("after-call.bedrock-runtime.*", refresh_token_on_error)

    return client


def _get_bedrock_runtime_client() -> Any:
    """
    Get a boto3 client for bedrock-runtime, with GenAIEH Gateway if available

    Returns:
        boto3 client configured for either Bedrock Runtime or GenAIEH Gateway
    """
    # Check if GenAIEH is properly configured
    is_genaieh_enabled, genaieh_config = is_genaieh_configured()

    if is_genaieh_enabled:
        logger.info("Using GenAIEH Gateway for bedrock-runtime")

        # Create the client
        client = _create_genaieh_boto_client(genaieh_config)

        # Set up token handling
        client = _setup_token_handlers(client, genaieh_config)

        logger.info("Configured lazy token loading for GenAIEH Gateway")
        return client

    # Fall back to regular Bedrock configuration
    return _get_standard_bedrock_client("bedrock-runtime")


def _get_standard_bedrock_client(service_name: str) -> Any:
    """
    Get a standard boto3 client for Bedrock services

    Args:
        service_name: AWS service name

    Returns:
        boto3 client for the specified service
    """
    config = genai_core.parameters.get_config()
    bedrock_config = config.get("bedrock", {})
    region = bedrock_config.get("region")

    if not region:
        region = "us-east-1"  # Default region

    client_config = Config(
        retries={"max_attempts": 10, "mode": "adaptive"},
        connect_timeout=5,
        read_timeout=60,
    )

    client = boto3.client(service_name, region_name=region, config=client_config)

    return client
