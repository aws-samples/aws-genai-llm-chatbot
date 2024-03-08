from .base import MultiModalModelBase
from genai_core.types import ChatbotAction, ChatbotMessageType
from urllib.parse import urljoin
import os
from genai_core.clients import get_bedrock_client
import json
import requests
from base64 import b64encode
from genai_core.registry import registry


def get_image_message(
    file: dict,
):
    img = requests.get(
        f"{urljoin(os.environ['CHATBOT_FILES_PRIVATE_API'], file['key'])}"
    ).content
    return {
        "type": "image",
        "source": {
            "type": "base64",
            "media_type": "image/jpeg",
            "data": str(b64encode(img), "ascii"),
        },
    }


class Claude3(MultiModalModelBase):
    model_id: str
    client: any

    def __init__(self, model_id: str):
        self.model_id = model_id
        self.client = get_bedrock_client()

    def format_prompt(self, prompt: str, messages: list, files: list) -> str:
        prompts = []

        # Chat history
        for message in messages:
            if message.type.lower() == ChatbotMessageType.Human.value.lower():
                user_msg = {
                    "role": "user",
                    "content": [{"type": "text", "text": message.content}],
                }
                prompts.append(user_msg)
                message_files = message.additional_kwargs.get("files", [])
                for message_file in message_files:
                    user_msg["content"].append(get_image_message(message_file))
            if message.type.lower() == ChatbotMessageType.AI.value.lower():
                prompts.append({"role": "assistant", "content": message.content})

        # User prompt
        user_msg = {
            "role": "user",
            "content": [{"type": "text", "text": prompt}],
        }
        prompts.append(user_msg)
        for file in files:
            user_msg["content"].append(get_image_message(file))

        return json.dumps(
            {
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 512,
                "messages": prompts,
                "temperature": 0.3,
            }
        )

    def handle_run(self, prompt: str, model_kwargs: dict):
        print(model_kwargs)
        body = json.loads(prompt)

        if "temperature" in model_kwargs:
            body["temperature"] = model_kwargs["temperature"]
        if "topP" in model_kwargs:
            body["top_p"] = model_kwargs["topP"]
        if "maxTokens" in model_kwargs:
            body["max_tokens"] = model_kwargs["maxTokens"]
        if "topK" in model_kwargs:
            body["top_k"] = model_kwargs["topK"]

        body_str = json.dumps(body)
        mlm_response = self.client.invoke_model(
            modelId=self.model_id,
            body=body_str,
            accept="application/json",
            contentType="application/json",
        )

        return json.loads(mlm_response["body"].read())["content"][0]["text"]

    def clean_prompt(self, prompt: str) -> str:
        p = json.loads(prompt)
        for m in p["messages"]:
            if m["role"] == "user" and type(m["content"]) == type([]):
                for c in m["content"]:
                    if c["type"] == "image":
                        c["source"]["data"] = ""
        return json.dumps(p)


registry.register(r"^bedrock.anthropic.claude-3.*", Claude3)
