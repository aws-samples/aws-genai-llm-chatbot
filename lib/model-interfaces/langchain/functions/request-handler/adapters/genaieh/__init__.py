# flake8: noqa
from adapters.genaieh.base import *
from adapters.genaieh.bedrock_chat import GenAIEHChatAdapter
from adapters.genaieh.openai_chat import GenAIEHOpenAIChatAdapter
from genai_core.registry import registry

# Register genaieh adapters
registry.register(r"^genaieh.bedrock*", GenAIEHChatAdapter)
registry.register(r"^genaieh.openai*", GenAIEHOpenAIChatAdapter)
registry.register(r"^genaieh.*", GenAIEHChatAdapter)
