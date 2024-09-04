from .base import BedrockChatAdapter
from genai_core.registry import registry


# Register the adapter
registry.register(r"^bedrock.anthropic.claude*", BedrockChatAdapter)
