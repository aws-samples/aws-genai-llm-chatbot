import os
from langchain_openai import AzureChatOpenAI

from ..base import ModelAdapter
from genai_core.registry import registry


class AzureGptAdapter(ModelAdapter):
    def __init__(self, model_id, *args, **kwargs):
        self.model_id = model_id

        super().__init__(*args, **kwargs)

    def get_llm(self, model_kwargs={}):
        if not os.environ.get(f"AZURE_OPENAI_API_KEY__{self.model_id}"):
            raise Exception("AZURE_OPENAI_API_KEY must be set in the environment")

        params = {}
        if "streaming" in model_kwargs:
            params["streaming"] = model_kwargs["streaming"]
        if "temperature" in model_kwargs:
            params["temperature"] = model_kwargs["temperature"]
        if "maxTokens" in model_kwargs:
            params["max_tokens"] = model_kwargs["maxTokens"]

        return AzureChatOpenAI(
            azure_endpoint=os.environ.get(f"AZURE_OPENAI_API_BASE__{self.model_id}"),
            deployment_name=os.environ.get(
                f"AZURE_OPENAI_API_DEPLOYMENT_NAME__{self.model_id}"
            ),
            openai_api_key=os.environ.get(f"AZURE_OPENAI_API_KEY__{self.model_id}"),
            openai_api_type=os.environ.get(f"AZURE_OPENAI_API_TYPE__{self.model_id}"),
            openai_api_version=os.environ.get(
                f"AZURE_OPENAI_API_VERSION__{self.model_id}"
            ),
            callbacks=[self.callback_handler],
            **params,
        )


# Register the adapter
registry.register(r"^azure.openai*", AzureGptAdapter)
