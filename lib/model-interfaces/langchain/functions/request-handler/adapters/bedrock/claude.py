import genai_core.clients

from langchain.llms import Bedrock
from langchain.prompts.prompt import PromptTemplate

from ..base import ModelAdapter
from ..registry import registry


class BedrockClaudeAdapter(ModelAdapter):
    def __init__(self, model_id, *args, **kwargs):
        self.model_id = model_id

        super().__init__(*args, **kwargs)

    def get_llm(self, model_kwargs={}):
        bedrock = genai_core.clients.get_bedrock_client()

        params = {}
        if "temperature" in model_kwargs:
            params["temperature"] = model_kwargs["temperature"]
        if "topP" in model_kwargs:
            params["top_p"] = model_kwargs["topP"]
        if "maxTokens" in model_kwargs:
            params["max_tokens_to_sample"] = model_kwargs["maxTokens"]

        return Bedrock(
            client=bedrock,
            model_id=self.model_id,
            model_kwargs=params,
            streaming=model_kwargs.get("streaming", False),
            callbacks=[self.callback_handler],
        )

    def get_qa_prompt(self, model_kwargs={}):
        return PromptTemplate(
            template=model_kwargs["personaPromptTemplate"], input_variables=["context", "question"]
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

    def get_condense_question_prompt(self, model_kwargs={}):
        return PromptTemplate(
            input_variables=["chat_history", "question"],
            chat_history="{chat_history}",
            template=model_kwargs["questionPromptTemplate"],
        )


# Register the adapter
registry.register(r"^bedrock.anthropic.claude*", BedrockClaudeAdapter)
