import os

from langchain_openai import ChatOpenAI

from adapters.base import ModelAdapter
from genai_core.registry import registry


class MinimaxChatAdapter(ModelAdapter):
    def __init__(self, model_id, *args, **kwargs):
        self.model_id = model_id

        super().__init__(*args, **kwargs)

    def get_llm(self, model_kwargs={}):
        api_key = os.environ.get("MINIMAX_API_KEY")
        if not api_key:
            raise Exception("MINIMAX_API_KEY must be set in the environment")

        params = {}
        if "streaming" in model_kwargs:
            params["streaming"] = model_kwargs["streaming"]
        if "temperature" in model_kwargs:
            temperature = model_kwargs["temperature"]
            # MiniMax accepts temperature in [0, 1]
            params["temperature"] = max(0.0, min(1.0, temperature))
        if "maxTokens" in model_kwargs:
            params["max_tokens"] = model_kwargs["maxTokens"]

        return ChatOpenAI(
            model_name=self.model_id,
            openai_api_key=api_key,
            openai_api_base="https://api.minimax.io/v1",
            callbacks=[self.callback_handler],
            **params,
        )


# Register the adapter
registry.register(r"^minimax*", MinimaxChatAdapter)
