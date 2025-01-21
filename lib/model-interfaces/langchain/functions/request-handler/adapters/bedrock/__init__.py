# flake8: noqa
from adapters.bedrock.base import *
from adapters.bedrock.media import *
from genai_core.registry import registry

# Register bedrock adapters
registry.register(r"^bedrock.ai21.jamba*", BedrockChatAdapter)
registry.register(r"^bedrock.ai21.j2*", BedrockChatNoStreamingNoSystemPromptAdapter)
registry.register(
    r"^bedrock\.cohere\.command-(text|light-text).*", BedrockChatNoSystemPromptAdapter
)
registry.register(r"^bedrock\.cohere\.command-r.*", BedrockChatAdapter)
registry.register(r"^bedrock.anthropic.claude*", BedrockChatAdapter)
registry.register(r"^bedrock.meta.llama*", BedrockChatAdapter)
registry.register(r"^bedrock.mistral.mistral-large*", BedrockChatAdapter)
registry.register(r"^bedrock.mistral.mistral-small*", BedrockChatAdapter)
registry.register(r"^bedrock.mistral.mistral-7b-*", BedrockChatNoSystemPromptAdapter)
registry.register(r"^bedrock.mistral.mixtral-*", BedrockChatNoSystemPromptAdapter)
registry.register(r"^bedrock.amazon.titan-image-generator*", BedrockChatMediaGeneration)
registry.register(r"^bedrock.amazon.titan-t*", BedrockChatNoSystemPromptAdapter)
registry.register(r"^bedrock.amazon.nova-reel*", BedrockChatMediaGeneration)
registry.register(r"^bedrock.amazon.nova-canvas*", BedrockChatMediaGeneration)
registry.register(r"^bedrock.amazon.nova*", BedrockChatAdapter)
registry.register(r"^bedrock.*.amazon.nova*", BedrockChatAdapter)
registry.register(r"^bedrock.*.anthropic.claude*", BedrockChatAdapter)
registry.register(r"^bedrock.*.meta.llama*", BedrockChatAdapter)
registry.register(r"^bedrock.*.mistral.mistral-large*", BedrockChatAdapter)
registry.register(r"^bedrock.*.mistral.mistral-small*", BedrockChatAdapter)
registry.register(r"^bedrock.*.mistral.mistral-7b-*", BedrockChatNoSystemPromptAdapter)
registry.register(r"^bedrock.*.mistral.mixtral-*", BedrockChatNoSystemPromptAdapter)
