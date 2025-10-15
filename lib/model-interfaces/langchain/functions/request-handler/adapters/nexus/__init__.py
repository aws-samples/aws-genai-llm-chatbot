# flake8: noqa
from adapters.nexus.base import *
from adapters.nexus.chat import NexusChatAdapter
from adapters.nexus.stream import NexusChatStreamAdapter
from genai_core.registry import registry

# Register nexus adapters
registry.register(r"^nexus.*", NexusChatAdapter)
registry.register(r"^nexus.*stream.*", NexusChatStreamAdapter)
