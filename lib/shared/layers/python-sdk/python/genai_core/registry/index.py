import re


class AdapterRegistry:
    def __init__(self):
        # The registry is a dictionary where:
        # Keys are compiled regular expressions
        # Values are model IDs
        self.registry = {}

    def register(self, regex, model_id):
        # Compiles the regex and stores it in the registry
        self.registry[re.compile(regex)] = model_id

    def get_adapter(self, model):
        # Iterates over the registered regexes
        for regex, adapter in self.registry.items():
            # If a match is found, returns the associated model ID
            if regex.match(model):
                return adapter
        # If no match is found, returns None
        raise ValueError(
            f"Adapter for model {model} not found in registry. "
            + f"Available adapters: {self.registry}"
        )
