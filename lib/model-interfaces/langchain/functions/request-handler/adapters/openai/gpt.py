import os
from langchain_openai import ChatOpenAI
from ..base import ModelAdapter
from genai_core.registry import registry


class GPTAdapter(ModelAdapter):
    def __init__(self, model_id, *args, **kwargs):
        self.model_id = model_id

        super().__init__(*args, **kwargs)

    def get_llm(self, model_kwargs={}):
        if not os.environ.get("OPENAI_API_KEY"):
            raise Exception("OPENAI_API_KEY must be set in the environment")

        params = {}
        if "streaming" in model_kwargs:
            params["streaming"] = model_kwargs["streaming"]
        if "temperature" in model_kwargs:
            params["temperature"] = model_kwargs["temperature"]
        if "maxTokens" in model_kwargs:
            params["max_tokens"] = model_kwargs["maxTokens"]

        return ChatOpenAI(
            model_name=self.model_id, callbacks=[self.callback_handler], **params
        )


# Register the adapter
registry.register(r"^openai*", GPTAdapter)
