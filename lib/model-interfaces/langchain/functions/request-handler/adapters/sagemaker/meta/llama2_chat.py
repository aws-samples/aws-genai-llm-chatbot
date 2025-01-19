import json
import os

from langchain_community.llms.sagemaker_endpoint import (
    LLMContentHandler,
    SagemakerEndpoint,
)

from ...base import ModelAdapter
from genai_core.registry import registry

from ...shared.meta.llama2_chat import (
    get_llama2_chat_condensed_qa_template,
    get_llama2_chat_qa_template,
    get_llama2_chat_template,
)
from ...shared.meta.llama2_chat import Llama2ConversationBufferMemory


class Llama2ChatContentHandler(LLMContentHandler):
    content_type = "application/json"
    accepts = "application/json"

    def clean_prompt(self, prompt):
        """Remove only the very last occurence of [/INST] tag if present"""
        if prompt.endswith("[/INST]"):
            prompt = prompt[: prompt.rfind("[/INST]")]
        return prompt

    def transform_input(self, prompt, model_kwargs) -> bytes:
        prompt = self.clean_prompt(prompt)
        input_str = json.dumps(
            {
                "inputs": [
                    [
                        {"role": "user", "content": prompt},
                    ],
                ],
                "parameters": model_kwargs,
            }
        )
        return input_str.encode("utf-8")

    def transform_output(self, output: bytes):
        response_json = json.loads(output.read().decode("utf-8"))
        return response_json[0]["generation"]["content"]


content_handler = Llama2ChatContentHandler()


class SMLlama2ChatAdapter(ModelAdapter):
    def __init__(self, model_id, **kwargs):
        self.model_id = model_id

        super().__init__(**kwargs)

    def get_memory(self, output_key=None, return_messages=False):
        return Llama2ConversationBufferMemory(
            memory_key="chat_history",
            chat_memory=self.chat_history,
            return_messages=return_messages,
            output_key=output_key,
        )

    def get_llm(self, model_kwargs={}):
        params = {}
        if "temperature" in model_kwargs:
            params["temperature"] = model_kwargs["temperature"]
        if "topP" in model_kwargs:
            params["top_p"] = model_kwargs["topP"]
        if "maxTokens" in model_kwargs:
            params["max_new_tokens"] = model_kwargs["maxTokens"]

        return SagemakerEndpoint(
            endpoint_name=self.model_id,
            region_name=os.environ.get("AWS_REGION"),
            model_kwargs=params,
            endpoint_kwargs={"CustomAttributes": "accept_eula=true"},
            content_handler=content_handler,
            callbacks=[self.callback_handler],
        )

    def get_prompt(self, custom_prompt):
        return get_llama2_chat_template(custom_prompt)

    def get_qa_prompt(self, custom_prompt):
        return get_llama2_chat_qa_template(custom_prompt)

    def get_condense_question_prompt(self, custom_prompt):
        return get_llama2_chat_condensed_qa_template(custom_prompt)


# Register the adapter
registry.register(r"(?i)sagemaker\.meta-LLama.*\d+b.*chat.*", SMLlama2ChatAdapter)
