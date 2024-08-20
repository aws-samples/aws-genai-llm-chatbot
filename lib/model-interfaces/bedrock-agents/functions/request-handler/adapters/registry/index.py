import re
from ..base import AgentAdapter


class AdapterRegistry:
    def __init__(self):
        # The registry is a dictionary where:
        # Keys are compiled regular expressions
        # Values are model IDs
        self.registry = {}

    def register(self, regex: str, agent: AgentAdapter):
        # Compiles the regex and stores it in the registry
        self.registry[re.compile(regex)] = agent

    def get_adapter(self, agent_id: str):
        # Iterates over the registered regexs
        for regex, adapter in self.registry.items():
            # If a match is found, returns the associated model ID
            if regex.match(agent_id):
                return adapter
        # If no match is found, returns None
        raise ValueError(
            f"Adapter for model {agent_id} not found in registry."
            + " Available adapters: {self.registry}"
        )
