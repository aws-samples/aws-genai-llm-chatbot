import json
import re
from typing import Optional

import genai_core.clients
from aws_lambda_powertools import Logger
from genai_core.models import get_model_by_name

logger = Logger()


class AdapterRegistry:
    def __init__(self):
        # The registry is a dictionary where:
        # Keys are compiled regular expressions
        # Values are model IDs
        self.registry = {}

    def register(self, regex, model_id):
        # Compiles the regex and stores it in the registry
        self.registry[re.compile(regex)] = model_id

    def get_adapter(self, model: str):
        logger.info(f"Getting adapter for model {model}")
        provider_model_name = _get_provider_name(model)
        is_nexus_enabled, _ = genai_core.clients.is_nexus_configured()
        return self._get_adapter(provider_model_name)

    def _get_adapter(self, model):
        for regex, adapter in self.registry.items():
            # If a match is found, returns the associated model ID
            if regex.match(model):
                return adapter
        # If no match is found, returns None
        raise ValueError(
            f"Adapter for model {model} not found in registry. "
            + f"Available adapters: {self.registry}"
        )


def _get_provider_name(model_provider_and_name: str) -> Optional[str]:
    # Check if Nexus is configured and enabled
    logger.info(f"Getting provider name for model {model_provider_and_name}")
    is_nexus_enabled, _ = genai_core.clients.is_nexus_configured()
    if not is_nexus_enabled:
        return model_provider_and_name
    model_provider = model_provider_and_name.split(".")[0]
    logger.info(f"Model provider {model_provider}")
    nexus_model = get_model_by_name(model_provider_and_name)
    logger.info(f"Found model {model_provider_and_name} {json.dumps(nexus_model)}")
    if not nexus_model:
        return model_provider_and_name
    return f"{model_provider}.{nexus_model.get('providerModelName')}"
