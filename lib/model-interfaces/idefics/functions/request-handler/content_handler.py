import json
from langchain.llms.sagemaker_endpoint import LLMContentHandler


class ContentHandler(LLMContentHandler):
    content_type = "application/json"
    accepts = "application/json"

    def transform_input(self, prompt: str, model_kwargs) -> bytes:
        req = {"inputs": prompt, "parameters": model_kwargs}
        input_str = json.dumps(req)
        return input_str.encode("utf-8")

    def transform_output(self, output: bytes):
        response_json = json.loads(output.read().decode("utf-8"))
        return response_json[0]["generated_text"].split("Assistant:")[-1]
