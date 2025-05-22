from abc import ABC, abstractmethod
from typing import Any, Optional

from ..types import EmbeddingsModel, Provider


class ModelProvider(ABC):
    """Interface for model providers"""

    @abstractmethod
    def list_models(self) -> list[dict[str, Any]]:
        """
        List available models

        Returns:
            List of model information dictionaries
        """
        raise NotImplementedError

    @abstractmethod
    def get_embedding_models(self) -> list[dict[str, Any]]:
        """
        List available embedding models

        Returns:
            List of embedding model information dictionaries
        """
        raise NotImplementedError

    @abstractmethod
    def get_embeddings_model(
        self, provider: Provider, name: str
    ) -> Optional[EmbeddingsModel]:
        raise NotImplementedError

    @abstractmethod
    def get_model_modalities(self, model_id: str) -> list[str]:
        raise NotImplementedError
