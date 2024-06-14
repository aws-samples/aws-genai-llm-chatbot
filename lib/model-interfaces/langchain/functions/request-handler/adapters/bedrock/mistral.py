from .llama2_chat import BedrockMetaLLama2ChatAdapter
from genai_core.registry import registry
import genai_core
from langchain_aws import BedrockLLM


class BedrockMistralAdapter(BedrockMetaLLama2ChatAdapter):
    def get_llm(self, model_kwargs={}):
        bedrock = genai_core.clients.get_bedrock_client()

        params = {}
        if "temperature" in model_kwargs:
            params["temperature"] = model_kwargs["temperature"]
        if "topP" in model_kwargs:
            params["top_p"] = model_kwargs["topP"]
        if "maxTokens" in model_kwargs:
            params["max_tokens"] = model_kwargs["maxTokens"]

        return BedrockLLM(
            client=bedrock,
            model_id=self.model_id,
            model_kwargs=params,
            streaming=model_kwargs.get("streaming", False),
            callbacks=[self.callback_handler],
        )


# Register the adapter
registry.register(
    r"^bedrock.mistral.mi.*",
    BedrockMistralAdapter,
)
