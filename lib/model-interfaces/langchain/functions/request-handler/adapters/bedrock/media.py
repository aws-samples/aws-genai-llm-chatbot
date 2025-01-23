import os
import base64
import json
import uuid
import mimetypes
import filetype
import secrets
from aws_lambda_powertools import Logger
from typing import List, Optional, Dict, Union
import boto3
from botocore.client import BaseClient
import genai_core.clients
from genai_core.types import (
    ChatbotMessageType,
    Modality,
    FileStorageProvider,
    CommonError,
)
from .base import BedrockChatAdapter

logger = Logger()
s3 = boto3.resource("s3")


class BedrockChatMediaGeneration(BedrockChatAdapter):
    """This is for supporting multimodal nova models"""

    def __init__(self, *args, **kwargs):
        logger.info(
            f"Initializing BedrockChatMediaGenerationAdapter with disabled streaming."  # noqa
        )
        super().__init__(disable_streaming=True, *args, **kwargs)

    def should_call_apply_bedrock_guardrails(self) -> bool:
        guardrails = self.get_bedrock_guardrails()
        # Because we are using the native bedrock invoke API, guardrail is not supported by default, so it has to be enabled. # noqa
        # https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference-supported-models-features.html # noqa
        return True and len(guardrails.keys()) > 0

    def _append_user_msg(self, prompts):
        user_msg = {
            "role": "user",
            "content": [],
        }
        prompts.append(user_msg)
        return user_msg

    def format_prompt(
        self, prompt: str, messages: list, files: list
    ) -> Dict[str, Union[List[str], str]]:
        prompts = []

        # Chat history
        for message in messages:
            # Human Messages
            if message.type.lower() == ChatbotMessageType.Human.value.lower():
                user_msg = self._append_user_msg(prompts)
                message_files = message.additional_kwargs.get("files", [])

                for message_file in message_files:
                    use_s3_path = False
                    if message_file["type"] == Modality.VIDEO.value:
                        use_s3_path = True

                    file_data = self.get_file_from_s3(
                        message_file, use_s3_path=use_s3_path
                    )
                    file_type = file_data.get("type")

                    user_msg["content"].append({file_type: file_data})

                user_msg["content"].append({"text": message.content})

            # AI Messages
            if message.type.lower() == ChatbotMessageType.AI.value.lower():
                prompts.append(
                    {
                        "role": "assistant",
                        "content": [{"text": message.content or "<EMPTY>"}],
                    }
                )

        # User prompt
        user_msg = self._append_user_msg(prompts)
        for file in files:
            use_s3_path = False
            if file["type"] == Modality.VIDEO.value:
                use_s3_path = True

            file_data = self.get_file_from_s3(file, use_s3_path=use_s3_path)
            file_type = file_data.get("type")

            user_msg["content"].append({file_type: file_data})

        user_msg["content"].append({"text": prompt})

        return {
            "messages": prompts,
            "last_message": prompt,
        }

    def guess_extension_from_bytes(self, image_bytes: bytes) -> Optional[str]:
        try:
            # Identify image format directly
            kind = filetype.guess(image_bytes)
            if not kind:
                return None
            # Use lowercase mimetypes and direct extension mapping
            mime_type = f"image/{kind.extension.lower()}"
            return mimetypes.guess_extension(mime_type, strict=True)
        except Exception:
            return None

    def upload_file_message(self, content: bytes, file_type: str):
        extension = self.guess_extension_from_bytes(content)
        key = f"{uuid.uuid4()}{f'{extension}' if extension else ''}"
        logger.info("Uploading file", key=key, extension=extension, file_type=file_type)

        s3_path = "private/" + self.user_id + "/" + key
        s3.Object(os.environ["CHATBOT_FILES_BUCKET_NAME"], s3_path).put(
            Body=content
        )  # noqa
        return {
            "provider": FileStorageProvider.S3.value,
            "key": key,
            "type": file_type,
        }

    def get_llm(self, model_kwargs={}, extra={}):
        bedrock = genai_core.clients.get_bedrock_client()
        if not bedrock:
            raise ValueError("Bedrock client is not initialized")

        self.client: BaseClient = bedrock

        guardrails = self.get_bedrock_guardrails()

        # Log all parameters in a single log entry
        logger.info(
            f"Creating LLM media generation chain for model {self.model_id}",
            model_kwargs=model_kwargs,
            guardrails=guardrails,
        )
        return bedrock

    def generate_image(self, input: dict, files: Optional[list] = None):
        if files is None:
            files = []

        logger.info(
            "Incoming request for nova image generation",
            model_kwargs=self.model_kwargs,
            prompt=input,
            files=files,
        )

        images = []
        for file in files:
            if file["type"] == Modality.IMAGE.value:
                image_data = self.get_file_from_s3(file)
                media_bytes = image_data["source"]["bytes"]
                images.append(
                    {
                        "format": image_data["format"],
                        "source": {
                            "bytes": base64.b64encode(media_bytes).decode("utf-8"),
                        },
                    }
                )

        # Prepare the image generation parameters
        text_to_image_params = {"text": input["last_message"]}

        # Text-to-image with image conditioning - uses the default controls
        # https://docs.aws.amazon.com/nova/latest/userguide/image-gen-req-resp-structure.html
        if len(images) > 0:
            text_to_image_params["conditionImage"] = images[0]["source"]["bytes"]

        inference_params = {
            "taskType": "TEXT_IMAGE",
            "textToImageParams": text_to_image_params,
            "imageGenerationConfig": {
                "numberOfImages": 1,
                "width": 1280,
                "height": 768,
                "cfgScale": 7.0,
                "seed": self.model_kwargs.get(
                    "seed", secrets.randbelow(2147483647)
                ),  # fmt: skip
            },
        }
        logger.info(
            f"Generating with seed: {inference_params['imageGenerationConfig']['seed']}"
        )
        response = self.client.invoke_model(
            modelId=self.model_id,
            body=json.dumps(inference_params),
        )
        logger.debug("Response from nova", response=response)
        logger.info(f"Request ID: {response['ResponseMetadata']['RequestId']}")

        response_body = json.loads(response["body"].read())
        images = response_body["images"]

        if "error" in response_body:
            if not images:
                logger.error("Error: No images generated.")
            logger.error(response_body["error"])
            raise CommonError("Error occured generating image")

        file_upload = self.upload_file_message(
            base64.b64decode(images[0]), Modality.IMAGE.value
        )
        response = {
            "images": [file_upload],
            "content": "Here's the result.",
        }
        return response

    def generate_video(self, input: dict, files: Optional[list] = None):
        if files is None:
            files = []

        logger.info(
            "Incoming request for nova video generation",
            model_kwargs=self.model_kwargs,
            input=input,
            files=files,
        )

        # Prepare the video generation parameters
        text_to_video_params = {
            "text": input["last_message"],
        }

        images = []
        for file in files:
            if file["type"] == Modality.IMAGE.value:
                image_data = self.get_file_from_s3(file)
                media_bytes = image_data["source"]["bytes"]
                images.append(
                    {
                        "format": image_data["format"],
                        "source": {
                            "bytes": base64.b64encode(media_bytes).decode("utf-8"),
                        },
                    }
                )

        if images:
            text_to_video_params["images"] = images
        model_input = {
            "taskType": "TEXT_VIDEO",
            "textToVideoParams": text_to_video_params,
            "videoGenerationConfig": {
                "durationSeconds": 6,
                "fps": 24,
                "dimension": "1280x720",
                "seed": self.model_kwargs.get(
                    "seed", secrets.randbelow(2147483647)
                ),  # fmt: skip
            },
        }
        logger.info("Model input", model_input=model_input)
        s3_path = f"private/{self.user_id}"
        output_data_config = {
            "s3OutputDataConfig": {
                "s3Uri": f"s3://{os.environ['CHATBOT_FILES_BUCKET_NAME']}/{s3_path}/"
            }
        }
        logger.info("Output data config", output_data_config=output_data_config)

        # Start the asynchronous video generation job.
        invocation_jobs = self.client.start_async_invoke(
            modelId=self.model_id,
            modelInput=model_input,
            outputDataConfig=output_data_config,
        )

        logger.info(
            "Response:",
            invocation_jobs=json.dumps(invocation_jobs, indent=2, default=str),
        )

        invocation_arn = invocation_jobs["invocationArn"]
        video_id = invocation_arn.split("/")[-1]
        video_path = f"{video_id}/output.mp4"
        return {
            "videos": [
                {
                    "provider": FileStorageProvider.S3.value,
                    "key": video_path,
                    "type": Modality.VIDEO.value,
                }
            ],
            "content": "Here's the result.",
        }
