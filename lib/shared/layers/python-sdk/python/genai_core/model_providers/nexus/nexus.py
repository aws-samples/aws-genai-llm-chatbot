"""
Nexus Gateway provider implementation.
"""

import logging
from abc import ABC
from functools import lru_cache
from typing import Any, Optional, Union

from genai_core.types import EmbeddingsModel, Provider

from ... import parameters
from .. import ModelProvider
from .nexus_client import NexusGatewayClient
from .types import ModelResponse

logger = logging.getLogger(__name__)


class NexusModelProvider(ModelProvider, ABC):
    """Provider for accessing models through the Nexus Gateway"""

    def list_models(self) -> list[dict[str, Any]]:
        """
        list all available models from the Nexus Gateway

        Returns:
            list of model information dictionaries
        """
        try:
            # Get models from the client
            client = _nexus_client()
            if client is None:
                return []

            models = client.list_application_models()

            # Transform models to the expected format
            return [_transform_nexus_model(model) for model in models]
        except Exception as e:
            logger.error(f"Error listing models from Nexus Gateway: {e!s}")
            return []

    def get_model_modalities(self, model_name: str) -> list[str]:
        """
        Get the modalities supported by a model

        Args:
            model_name: The name of the model

        Returns:
            list of modality names
        """
        for model in self.list_models():
            if model["name"] == model_name:
                return model.get("inputModalities", [])
        return []

    def get_embeddings_model(
        self, provider: Provider, model_name: str
    ) -> Optional[EmbeddingsModel]:
        """
        Get a specific embedding model by provider and name

        Args:
            provider: The provider name (e.g., "bedrock")
            model_name: The model name

        Returns:
            Embedding model information or None if not found
        """
        embedding_models = self.get_embedding_models()

        for model in embedding_models:
            if model.get("provider") == provider and model.get("name") == model_name:
                return EmbeddingsModel(**model)

        return None

    def get_embedding_models(self) -> list[dict[str, Any]]:
        """
        Get all available embedding models

        Returns:
            list of embedding model information dictionaries
        """
        try:
            # Filter for embedding models
            return [
                model
                for model in self.list_models()
                if model.get("inputModalities") == ["text"]
                and not model.get("outputModalities")
            ]
        except Exception as e:
            logger.error(f"Error getting embedding models: {e!s}")
            return []


@lru_cache(maxsize=1)
def _nexus_client() -> Optional[NexusGatewayClient]:
    config = parameters.get_config()
    nexus_config = config.get("nexus", {})
    if not nexus_config.get("enabled", False):
        return None
    return NexusGatewayClient(nexus_config)


def _transform_nexus_model(
    model: Union[dict[str, Any], ModelResponse]
) -> dict[str, Any]:
    """
    Transform a Nexus model to the format expected by the application

    Args:
        model: Nexus model data

    Returns:
        Transformed model data
    """
    # Convert ModelResponse to dict if needed
    model_dict = model.to_dict() if isinstance(model, ModelResponse) else model

    # Extract basic information
    model_name = model_dict.get("modelName", "Unknown Model")

    # Extract provider information
    provider_info = model_dict.get("modelProvider", {})
    provider_name = provider_info.get("modelProviderName", "Unknown Provider")
    provider_model_name = provider_info.get("model", model_name)

    # Determine model mode
    mode = model_dict.get("mode", "")

    # Set modalities based on mode
    input_modalities = ["text"]  # Default to text input
    output_modalities = []

    if mode == "chat" or mode == "completion":
        output_modalities = ["text"]
        rag_supported = True
        streaming = True
    elif mode == "embedding":
        rag_supported = False
        streaming = False
    else:
        rag_supported = False
        streaming = False

    # Build the transformed model
    return {
        "name": model_name,
        "provider": provider_name,
        "providerModelName": provider_model_name,
        "ragSupported": rag_supported,
        "streaming": streaming,
        "inputModalities": input_modalities,
        "outputModalities": output_modalities,
    }
