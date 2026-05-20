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
    from .genaieh import GenAIEHModelProvider

    return GenAIEHModelProvider() if _is_genaieh_enabled() else DirectModelProvider()


def _is_genaieh_enabled() -> bool:
    """
    Check if GenAIEH integration is enabled in the configuration

    Returns:
        bool: True if GenAIEH is enabled, False otherwise
    """
    config = parameters.get_config()
    genaieh_config = config.get("genaieh", {})

    return bool(genaieh_config.get("enabled", False))
