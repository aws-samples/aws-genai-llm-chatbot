import json
import mimetypes
import os
import uuid
from abc import abstractmethod
from dataclasses import dataclass, field
from typing import Optional

import boto3
from aws_lambda_powertools import Logger
from genai_core.clients import get_bedrock_client
from genai_core.types import ChatbotMessageType

logger = Logger()
s3 = boto3.resource("s3")


@dataclass
class MultiModalModelBase:
    model_id: str
    session_id: Optional[str]
    user_id: Optional[str]
    disable_streaming: Optional[bool] = False
    model_kwargs: Optional[dict] = field(default_factory=dict)
    mode: Optional[str] = None
    client: Optional[any] = get_bedrock_client()

    @abstractmethod
    def handle_run(
        self, input: dict, model_kwargs: dict, files: Optional[list] = None
    ) -> str: ...

    @abstractmethod
    def on_llm_new_token(self, user_id: str, session_id: str, chunk: str) -> None: ...

    def upload_file_message(self, content: bytes, file_type: str):
        key = str(uuid.uuid4())
        s3_path = "private/" + self.user_id + "/" + key
        s3.Object(os.environ["CHATBOT_FILES_BUCKET_NAME"], s3_path).put(Body=content)
        return {
            "provider": "s3",
            "key": key,
            "type": file_type,
        }

    def get_file_message(self, file: dict, use_s3_path: Optional[bool] = False):
        if file["key"] is None:
            raise Exception("Invalid S3 Key " + file["key"])

        key = "private/" + self.user_id + "/" + file["key"]
        logger.info(
            "Fetching file", bucket=os.environ["CHATBOT_FILES_BUCKET_NAME"], key=key
        )
        extension = mimetypes.guess_extension(file["key"]) or file["key"].split(".")[-1]
        mime_type = mimetypes.guess_type(file["key"])[0]
        file_type = mime_type.split("/")[0]
        logger.info("File type", file_type=file_type)
        logger.info("File extension", extension=extension)
        logger.info("File mime type", mime_type=mime_type)
        format = mime_type.split("/")[-1] or extension

        response = s3.Object(os.environ["CHATBOT_FILES_BUCKET_NAME"], key)
        logger.info("File response", response=response)
        media_bytes = response.get()["Body"].read()

        source = {}
        if use_s3_path:
            source["s3Location"] = {
                "uri": f"s3://{os.environ['CHATBOT_FILES_BUCKET_NAME']}/{key}",
            }
        else:
            source["bytes"] = media_bytes

        return {
            file_type: {
                "format": format,
                "source": source,
            }
        }

    def format_prompt(self, prompt: str, messages: list, files: list) -> str:
        prompts = []

        # Chat history
        for message in messages:
            if message.type.lower() == ChatbotMessageType.Human.value.lower():
                user_msg = {
                    "role": "user",
                    "content": [],
                }
                prompts.append(user_msg)
                message_files = message.additional_kwargs.get("files", [])

                for message_file in message_files:
                    user_msg["content"].append(self.get_file_message(message_file))

                user_msg["content"].append({"text": message.content})

            if message.type.lower() == ChatbotMessageType.AI.value.lower():
                prompts.append(
                    {
                        "role": "assistant",
                        "content": [{"text": message.content or "<EMPTY>"}],
                    }
                )

        # User prompt
        user_msg = {
            "role": "user",
            "content": [],
        }
        prompts.append(user_msg)
        for file in files:
            user_msg["content"].append(self.get_file_message(file))

        user_msg["content"].append({"text": prompt})

        return {
            "messages": prompts,
            "last_message": prompt,
        }

    def clean_prompt(self, input: dict) -> str:
        for m in input["messages"]:
            if m["role"] == "user" and type(m["content"]) == type([]):  # noqa: E721
                for c in m["content"]:
                    if "video" in c:
                        c["video"]["source"]["bytes"] = ""
                    if "image" in c:
                        c["image"]["source"]["bytes"] = ""
        return json.dumps(input)

    @abstractmethod
    def generate_image(self, input: dict, model_kwargs: dict): ...

    @abstractmethod
    def generate_video(self, input: dict, model_kwargs: dict): ...

    def converse(self, input: dict, model_kwargs: dict):
        logger.info("Incoming request for nova", model_kwargs=model_kwargs)
        logger.info("Mode", mode=self.mode)
        streaming = model_kwargs.get("streaming", False)

        complete_response = ""
        inf_params = {}

        if "temperature" in model_kwargs:
            inf_params["temperature"] = model_kwargs["temperature"]
        if "topP" in model_kwargs:
            inf_params["topP"] = model_kwargs["topP"]
        if "maxTokens" in model_kwargs:
            inf_params["maxTokens"] = model_kwargs["maxTokens"]

        stream_params = {
            "modelId": self.model_id,
            "messages": input["messages"],
            "inferenceConfig": inf_params,
        }
        logger.info("Stream params", stream_params=stream_params)

        if streaming:
            logger.info("Calling converse_stream")
            mlm_response = self.client.converse_stream(
                **stream_params,
            )
            logger.info("Stream response", mlm_response=mlm_response)
            stream = mlm_response.get("stream")
            if stream:
                logger.info("Sending stream events to on_llm_new_token")
                for event in stream:
                    if "contentBlockDelta" in event:
                        chunk = event["contentBlockDelta"]["delta"]["text"]
                        complete_response += chunk
                        self.on_llm_new_token(chunk)

            logger.info("Complete response", complete_response=complete_response)
            return {
                "content": complete_response,
            }

        logger.info("Calling converse")
        mlm_response = self.client.converse(
            **stream_params,
        )
        logger.info("Response from nova", mlm_response=mlm_response)
        content = mlm_response["output"]["message"]["content"][0]["text"]

        return {
            "content": content,
        }
