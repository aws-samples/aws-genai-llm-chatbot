from genai_core.registry import registry
from .agent import BedrockAgentAdapter

# Register the BedrockAgentAdapter for all bedrock agent patterns
# This matches both the generic "bedrock_agent" and specific agent names like "Agent_MyAgent_A12345"
registry.register(r"^bedrock\.(?:bedrock_agent|Agent_.+_.+)$", BedrockAgentAdapter)
