from genai_core.registry import registry
from .agent import BedrockAgentAdapter

# Register the BedrockAgentAdapter for the bedrock_agent pattern
registry.register(r"^bedrock\.bedrock_agent$", BedrockAgentAdapter)
