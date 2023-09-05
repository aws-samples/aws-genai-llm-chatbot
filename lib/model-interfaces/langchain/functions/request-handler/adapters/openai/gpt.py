import os

from langchain.chat_models import ChatLiteLLM

from ..base import ModelAdapter
from ..registry import registry


class GPTAdapter(ModelAdapter):
    def __init__(self, model_id, *args, **kwargs):
        self.model_id = model_id

        super().__init__(*args, **kwargs)

    def get_llm(self, model_kwargs={}):
        if not os.environ.get("OPENAI_API_KEY"):
            raise Exception("OPENAI_API_KEY must be set in the environment")
        # use 100+ LLMs simply pass in the LLM as model_name
        return ChatLiteLLM(model_name=self.model_id, temperature=0, **model_kwargs)


# Register the adapter
registry.register(r"^openai*", GPTAdapter)
