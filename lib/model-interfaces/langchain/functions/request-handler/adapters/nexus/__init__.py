# flake8: noqa
from adapters.nexus.base import *
from adapters.nexus.bedrock_chat import NexusChatAdapter
from adapters.nexus.openai_chat import NexusOpenAIChatAdapter
from genai_core.registry import registry

# Register nexus adapters
registry.register(r"^nexus.bedrock*", NexusChatAdapter)
registry.register(r"^nexus.openai*", NexusOpenAIChatAdapter)
registry.register(r"^nexus.*", NexusChatAdapter)
