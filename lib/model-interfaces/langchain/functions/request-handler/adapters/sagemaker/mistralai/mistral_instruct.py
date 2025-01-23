import json
import os

from langchain_community.llms.sagemaker_endpoint import (
    LLMContentHandler,
    SagemakerEndpoint,
)
from langchain.prompts.prompt import PromptTemplate

from ...base import ModelAdapter
from genai_core.registry import registry


class MistralInstructContentHandler(LLMContentHandler):
    content_type = "application/json"
    accepts = "application/json"

    def transform_input(self, prompt, model_kwargs) -> bytes:
        input_str = json.dumps(
            {
                "inputs": prompt,
                "parameters": {
                    "do_sample": True,
                    "max_new_tokens": model_kwargs.get("max_new_tokens", 512),
                    "top_p": model_kwargs.get("top_p", 0.9),
                    "temperature": model_kwargs.get("temperature", 0.6),
                    "return_full_text": False,
                    "stop": ["###", "</s>"],
                },
            }
        )
        return input_str.encode("utf-8")

    def transform_output(self, output: bytes):
        response_json = json.loads(output.read().decode("utf-8"))
        return response_json[0]["generated_text"]


content_handler = MistralInstructContentHandler()


class SMMistralInstructAdapter(ModelAdapter):
    def __init__(self, model_id, **kwargs):
        self.model_id = model_id

        super().__init__(**kwargs)

    def get_llm(self, model_kwargs={}):
        params = {}
        if "temperature" in model_kwargs:
            params["temperature"] = model_kwargs["temperature"]
        if "topP" in model_kwargs:
            params["top_p"] = model_kwargs["topP"]
        if "maxTokens" in model_kwargs:
            params["max_new_tokens"] = model_kwargs["maxTokens"]

        return SagemakerEndpoint(
            endpoint_name=self.get_endpoint(self.model_id),
            region_name=os.environ["AWS_REGION"],
            content_handler=content_handler,
            model_kwargs=params,
            callbacks=[self.callback_handler],
        )

    def get_qa_prompt(self, custom_prompt):
        if custom_prompt:
            system_prompt = custom_prompt
        else:
            system_prompt = "Use the following pieces of context to answer the question at the end. If you don't know the answer, just say that you don't know, don't try to make up an answer."  # noqa: E501
        template = """<s>[INST] {system_prompt}[/INST]

{context}
</s>[INST] {question} [/INST]"""  # noqa: E501

        return PromptTemplate.from_template(template).partial(
            system_prompt=system_prompt
        )

    def get_prompt(self, custom_prompt):
        if custom_prompt:
            system_prompt = custom_prompt
        else:
            system_prompt = "The following is a friendly conversation between a human and an AI. If the AI does not know the answer to a question, it truthfully says it does not know."  # noqa: E501
        template = """<s>[INST] {system_prompt}[/INST]

{chat_history}
<s>[INST] {input} [/INST]"""  # noqa: E501

        return PromptTemplate.from_template(template).partial(
            system_prompt=system_prompt
        )

    def get_condense_question_prompt(self, custom_prompt):
        if custom_prompt:
            system_prompt = custom_prompt
        else:
            system_prompt = "Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question, in its original language."  # noqa: E501
        template = """<s>[INST] {system_prompt}[/INST]

{chat_history}
</s>[INST] {question} [/INST]"""  # noqa: E501

        return PromptTemplate.from_template(template).partial(
            system_prompt=system_prompt
        )


# Register the adapter
registry.register(r"(?i)sagemaker\.mistralai-Mistral*", SMMistralInstructAdapter)
registry.register(r"(?i)sagemaker\.mistralai/Mistral*", SMMistralInstructAdapter)
