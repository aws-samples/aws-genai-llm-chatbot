import json
import os

from langchain.llms.sagemaker_endpoint import LLMContentHandler, SagemakerEndpoint
from langchain.prompts.prompt import PromptTemplate

from ...base import ModelAdapter
from genai_core.registry import registry


class Dolly2BContentHandler(LLMContentHandler):
    content_type = "application/json"
    accepts = "application/json"

    def transform_input(self, prompt, model_kwargs) -> bytes:
        input_str = json.dumps(
            {
                "inputs": prompt,
                "parameters": {
                    "max_new_tokens": model_kwargs.get("max_new_tokens", 512),
                    "temperature": model_kwargs.get("temperature", 0.6),
                    "stop": ["Question:", "###", "</s>"],
                    "do_sample": True,
                },
            }
        )
        return input_str.encode("utf-8")

    def transform_output(self, output: bytes):
        response_json = json.loads(output.read().decode("utf-8"))
        return response_json[0]["generated_text"].removesuffix("Question:")


content_handler = Dolly2BContentHandler()


class Dolly2BAdapter(ModelAdapter):
    def __init__(self, model_id, **kwargs):
        self.model_id = model_id

        super().__init__(**kwargs)

    def get_llm(self, model_kwargs={}):
        params = {}
        if "temperature" in model_kwargs:
            params["temperature"] = model_kwargs["temperature"]
        if "maxTokens" in model_kwargs:
            params["max_new_tokens"] = model_kwargs["maxTokens"]

        return SagemakerEndpoint(
            # Prefix added here 
            # https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/src/patterns/gen-ai/aws-model-deployment-sagemaker/jumpstart-sagemaker-endpoint.ts#L130
            endpoint_name="jumpstart-" + self.model_id,
            region_name=os.environ["AWS_REGION"],
            content_handler=content_handler,
            model_kwargs=params,
            callbacks=[self.callback_handler],
        )


    def get_prompt(self):
        template = """You are an AI assistant. If the assistant does not know the answer to a question, it truthfully says it does not know.

Current conversation:
{chat_history}

Question: {input}

Response:"""  # noqa: E501

        input_variables = ["input", "chat_history"]
        prompt_template_args = {
            "chat_history": "{chat_history}",
            "input_variables": input_variables,
            "template": template,
        }
        prompt_template = PromptTemplate(**prompt_template_args)

        return prompt_template


# Register the adapter
registry.register(r"(?i)sagemaker\.dolly*", Dolly2BAdapter)
