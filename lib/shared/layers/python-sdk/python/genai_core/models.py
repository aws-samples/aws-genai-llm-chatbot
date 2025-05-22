from typing import Any, Optional

from aws_lambda_powertools import Logger

logger = Logger()


def list_models() -> list[dict[str, Any]]:
    """
    Get a list of all available models from model provider

    Returns:
        list[dict[str, Any]]: List of model information dictionaries
    """
    # Import here to avoid circular imports
    from .model_providers import get_model_provider

    return get_model_provider().list_models()


def get_model_modalities(model_id: str) -> list[str]:
    """
    Get the output modalities for a given model

    Args:
        model_id: The ID of the model to get modalities for

    Returns:
        list[str]: List of output modality names
    """
    # Import here to avoid circular imports
    from .model_providers import get_model_provider

    return get_model_provider().get_model_modalities(model_id)


def get_model_by_name(name: str) -> Optional[dict[str, Any]]:
    """
    Get a list of all available models from model provider

    Args:
        name: The name of the model

    Returns:
        dict[str, Any]: Model information dictionary
    """
    logger.info(f"Getting model by name: {name}")
    parts = name.split(".")
    provider, name = parts[0], parts[1]
    models = list_models()

    for model in filter(
        lambda m: m.get("provider") == provider and m.get("name") == name, models
    ):
        return model
    return None
