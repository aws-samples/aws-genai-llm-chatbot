# flake8: noqa
from adapters.nexus.base import *
from adapters.nexus.stream import NexusChatStreamAdapter
from genai_core.registry import registry

# Register nexus adapters
registry.register(r"^nexus.*", NexusChatStreamAdapter)
