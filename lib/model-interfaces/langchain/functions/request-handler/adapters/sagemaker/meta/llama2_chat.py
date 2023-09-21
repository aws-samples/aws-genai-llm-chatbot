import json
import os

from langchain.llms.sagemaker_endpoint import LLMContentHandler, SagemakerEndpoint

from ...base import ModelAdapter
from ...registry import registry


class Llama2ChatContentHandler(LLMContentHandler):
    content_type = "application/json"
    accepts = "application/json"

    def transform_input(self, prompt, model_kwargs) -> bytes:
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

    def get_llm(self, *args, **kwargs):
        return SagemakerEndpoint(
            endpoint_name=self.model_id,
            region_name=os.environ.get("AWS_REGION"),
            model_kwargs={"max_new_tokens": 256, "top_p": 0.9, "temperature": 0.6},
            endpoint_kwargs={"CustomAttributes": "accept_eula=true"},
            content_handler=content_handler,
        )


# Register the adapter
registry.register(r"(?i)sagemaker\.meta-LLama.*\d+b.*chat.*", SMLlama2ChatAdapter)
