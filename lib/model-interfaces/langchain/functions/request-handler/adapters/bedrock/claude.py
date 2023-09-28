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

    def get_qa_prompt(self):
        template = """

Human: Use the following pieces of context to answer the question at the end. If you don't know the answer, just say that you don't know, don't try to make up an answer.

{context}

Question: {question}

Assistant:"""

        return PromptTemplate(
            template=template, input_variables=["context", "question"]
        )

    def get_prompt(self):
        template = """

Human: The following is a friendly conversation between a human and an AI. If the AI does not know the answer to a question, it truthfully says it does not know.

Current conversation:
{chat_history}

Question: {input}

Assistant:"""

        input_variables = ["input", "chat_history"]
        prompt_template_args = {
            "chat_history": "{chat_history}",
            "input_variables": input_variables,
            "template": template,
        }
        prompt_template = PromptTemplate(**prompt_template_args)

        return prompt_template

    def get_condense_question_prompt(self):
        template = """
{chat_history}

Human: Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question, in its original language.
Follow Up Input: {question}

Assistant:"""

        return PromptTemplate(
            input_variables=["chat_history", "question"],
            chat_history="{chat_history}",
            template=template,
        )


# Register the adapter
registry.register(r"^bedrock.anthropic.claude*", BedrockClaudeAdapter)
