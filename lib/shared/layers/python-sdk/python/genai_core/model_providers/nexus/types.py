"""
Type definitions for the Nexus Gateway API based on Smithy definitions.
"""

from dataclasses import dataclass, field
from typing import Any, Literal, Optional

# Enum types
ModelProviderName = Literal[
    "openai", "bedrock", "anthropic", "cohere", "ai21", "mistral"
]
ModelMode = Literal["embedding", "chat", "completion"]
ApplicationStatus = Literal["OPEN", "APPROVED", "REJECTED"]


@dataclass
class NexusGatewayConfig:
    """Configuration for the Nexus Gateway client"""

    gateway_url: Optional[str] = None
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    token_url: Optional[str] = None
    enabled: bool = False

    @classmethod
    def from_dict(cls, config: dict[str, Any]) -> "NexusGatewayConfig":
        """Create a configuration object from a dictionary"""
        gateway_url = config.get("gatewayUrl")
        if gateway_url and gateway_url.endswith("/"):
            gateway_url = gateway_url[:-1]  # Remove trailing slash

        return cls(
            gateway_url=gateway_url,
            client_id=config.get("clientId"),
            client_secret=config.get("clientSecret"),
            token_url=config.get("tokenUrl"),
            enabled=config.get("enabled", False),
        )


@dataclass
class ApiError:
    """API error response"""

    error_type: str
    message: str
    status_code: Optional[int] = None

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary format"""
        result = {"error": self.error_type, "message": self.message}
        if self.status_code:
            result["statusCode"] = self.status_code
        return result


@dataclass
class ControlParameters:
    """Control parameters for rate limiting and timeouts"""

    max_token_per_min: int = 0
    max_request_per_min: int = 0
    request_timeout: float = 0.0

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "ControlParameters":
        return cls(
            max_token_per_min=data.get("maxTokenPerMin", 0),
            max_request_per_min=data.get("maxRequestPerMin", 0),
            request_timeout=data.get("requestTimeout", 0.0),
        )


@dataclass
class PricingConfiguration:
    """Pricing configuration for token costs"""

    input_cost_per_token: float = 0.0
    output_cost_per_token: float = 0.0

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "PricingConfiguration":
        return cls(
            input_cost_per_token=data.get("inputCostPerToken", 0.0),
            output_cost_per_token=data.get("outputCostPerToken", 0.0),
        )


@dataclass
class ModelProvider:
    """Model provider configuration"""

    model_provider_name: ModelProviderName
    model: str = ""
    api_access_key_id: Optional[str] = None
    api_access_key: Optional[str] = None
    api_endpoint: Optional[str] = None
    api_version: Optional[str] = None
    region_name: Optional[str] = None

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "ModelProvider":
        return cls(
            model_provider_name=data.get("modelProviderName", "bedrock"),
            model=data.get("model", ""),
            api_access_key_id=data.get("apiAccessKeyId"),
            api_access_key=data.get("apiAccessKey"),
            api_endpoint=data.get("apiEndpoint"),
            api_version=data.get("apiVersion"),
            region_name=data.get("regionName"),
        )


@dataclass
class ModelResponse:
    """Model information returned from the API"""

    model_id: str
    model_name: str
    model_provider: ModelProvider
    mode: Optional[ModelMode] = None
    control_params: ControlParameters = field(default_factory=ControlParameters)
    pricing: PricingConfiguration = field(default_factory=PricingConfiguration)
    dimensions: Optional[int] = None

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "ModelResponse":
        return cls(
            model_id=data.get("modelId", ""),
            model_name=data.get("modelName", ""),
            model_provider=ModelProvider.from_dict(data.get("modelProvider", {})),
            mode=data.get("mode"),
            control_params=ControlParameters.from_dict(data.get("controlParams", {})),
            pricing=PricingConfiguration.from_dict(data.get("pricing", {})),
            dimensions=data.get("dimensions"),
        )

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary format"""
        result = {
            "modelId": self.model_id,
            "modelName": self.model_name,
            "modelProvider": {
                "modelProviderName": self.model_provider.model_provider_name,
                "model": self.model_provider.model,
            },
            "mode": self.mode,
        }

        # Add optional fields if they have values
        if self.model_provider.api_access_key_id:
            result["modelProvider"][
                "apiAccessKeyId"
            ] = self.model_provider.api_access_key_id
        if self.model_provider.api_access_key:
            result["modelProvider"]["apiAccessKey"] = self.model_provider.api_access_key
        if self.model_provider.api_endpoint:
            result["modelProvider"]["apiEndpoint"] = self.model_provider.api_endpoint
        if self.model_provider.api_version:
            result["modelProvider"]["apiVersion"] = self.model_provider.api_version
        if self.model_provider.region_name:
            result["modelProvider"]["regionName"] = self.model_provider.region_name

        # Add control parameters if they have non-default values
        if (
            self.control_params.max_token_per_min > 0
            or self.control_params.max_request_per_min > 0
            or self.control_params.request_timeout > 0
        ):
            result["controlParams"] = {
                "maxTokenPerMin": self.control_params.max_token_per_min,
                "maxRequestPerMin": self.control_params.max_request_per_min,
                "requestTimeout": self.control_params.request_timeout,
            }

        # Add pricing if it has non-default values
        if (
            self.pricing.input_cost_per_token > 0
            or self.pricing.output_cost_per_token > 0
        ):
            result["pricing"] = {
                "inputCostPerToken": self.pricing.input_cost_per_token,
                "outputCostPerToken": self.pricing.output_cost_per_token,
            }

        # Add dimensions for embedding models
        if self.dimensions:
            result["dimensions"] = self.dimensions

        return result


@dataclass
class ListApplicationModelsRequest:
    """Request for listing models available to an application"""

    authorization_token: Optional[str] = None

    def get_headers(self) -> dict[str, str]:
        """Get headers for the request"""
        headers = {}
        if self.authorization_token:
            headers["Authorization"] = self.authorization_token
        return headers


@dataclass
class ListApplicationModelsResponse:
    """Response containing models available to an application"""

    models: list[ModelResponse] = field(default_factory=list)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "ListApplicationModelsResponse":
        models_data = data.get("models", [])
        return cls(models=[ModelResponse.from_dict(model) for model in models_data])
