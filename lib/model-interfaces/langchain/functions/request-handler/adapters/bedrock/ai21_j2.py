import genai_core.clients
from langchain.llms import Bedrock
from langchain.prompts.prompt import PromptTemplate

from ..base import ModelAdapter
from ..registry import registry


class AI21J2Adapter(ModelAdapter):
    def __init__(self, model_id, *args, **kwargs):
        self.model_id = model_id

        super().__init__(*args, **kwargs)

    def get_llm(self, model_kwargs={}):
        bedrock = genai_core.clients.get_bedrock_client()

        params = {}
        if "temperature" in model_kwargs:
            params["temperature"] = model_kwargs["temperature"]
        if "topP" in model_kwargs:
            params["topP"] = model_kwargs["topP"]
        if "maxTokens" in model_kwargs:
            params["maxTokens"] = model_kwargs["maxTokens"]

        return Bedrock(
            client=bedrock,
            model_id=self.model_id,
            model_kwargs=params,
            callbacks=[self.callback_handler],
        )

    def get_prompt(self, model_kwargs={}):
        input_variables = ["input", "chat_history"]
        prompt_template_args = {
            "chat_history": "{chat_history}",
            "input_variables": input_variables,
            "template": model_kwargs["promptTemplate"],
        }
        prompt_template = PromptTemplate(**prompt_template_args)

        return prompt_template


# Register the adapter
registry.register(r"^bedrock.ai21.j2*", AI21J2Adapter)
