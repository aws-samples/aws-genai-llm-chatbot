import genai_core.parameters as parameters

from .types import ModelProvider

__all__ = ["get_model_provider"]


def get_model_provider() -> ModelProvider:
    """
    Factory function to get the appropriate model provider

    Returns:
        ModelProvider: An instance of a ModelProvider implementation
    """
    # Import here to avoid circular imports
    from .direct.provider import DirectModelProvider
    from .nexus import NexusModelProvider

    return NexusModelProvider() if _is_nexus_enabled() else DirectModelProvider()


def _is_nexus_enabled() -> bool:
    """
    Check if Nexus integration is enabled in the configuration

    Returns:
        bool: True if Nexus is enabled, False otherwise
    """
    config = parameters.get_config()
    nexus_config = config.get("nexus", {})

    return bool(nexus_config.get("enabled", False))
