import genai_core.clients

from langchain.llms import Bedrock
from langchain.prompts.prompt import PromptTemplate

from ..base import ModelAdapter
from ..registry import registry


class BedrockCohereCommandAdapter(ModelAdapter):
    def __init__(self, model_id, *args, **kwargs):
        self.model_id = model_id

        super().__init__(*args, **kwargs)

    def get_llm(self, model_kwargs={}):
        bedrock = genai_core.clients.get_bedrock_client()

        params = {}
        if "temperature" in model_kwargs:
            params["temperature"] = model_kwargs["temperature"]
        if "maxTokens" in model_kwargs:
            params["max_tokens"] = model_kwargs["maxTokens"]
        params["return_likelihoods"] = "GENERATION"

        return Bedrock(
            client=bedrock,
            model_id=self.model_id,
            model_kwargs=params,
            streaming=model_kwargs.get("streaming", False),
            callbacks=[self.callback_handler],
        )

    def get_prompt(self):
        template = """Het volgende is een vriendschappelijk gesprek tussen een mens en een AI. Als de AI het antwoord op een vraag niet weet, zegt hij eerlijk dat hij het niet weet.

        Huidig gesprek:
        {chat_history}

        Vraag: {input}
        
        Assistent:"""

        input_variables = ["input", "chat_history"]
        prompt_template_args = {
            "chat_history": "{chat_history}",
            "input_variables": input_variables,
            "template": template,
        }
        prompt_template = PromptTemplate(**prompt_template_args)

        return prompt_template


# Register the adapter
registry.register(r"^bedrock.cohere.command-text*", BedrockCohereCommandAdapter)
