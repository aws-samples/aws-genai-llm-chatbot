import base64
import json
import os
from random import randint
from typing import Optional
from aws_lambda_powertools import Logger
from genai_core.registry import registry
from genai_core.types import ChatbotMessageType, Modality

from .base import MultiModalModelBase

logger = Logger()


class Nova(MultiModalModelBase):
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
                    use_s3_path = False
                    if message_file["type"] == Modality.VIDEO.value:
                        use_s3_path = True

                    user_msg["content"].append(
                        self.get_file_message(message_file, use_s3_path=use_s3_path)
                    )

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
            use_s3_path = False
            if file["type"] == Modality.VIDEO.value:
                use_s3_path = True

            user_msg["content"].append(
                self.get_file_message(file, use_s3_path=use_s3_path)
            )

        user_msg["content"].append({"text": prompt})

        return {
            "messages": prompts,
            "last_message": prompt,
        }

    def handle_run(self, input: dict, model_kwargs: dict, files: Optional[list] = None):
        if self.mode == Modality.IMAGE.value:
            return self.generate_image(input, model_kwargs, files)
        if self.mode == Modality.VIDEO.value:
            return self.generate_video(input, model_kwargs, files)

        return self._run(input, model_kwargs, files)

    def _run(self, input: dict, model_kwargs: dict, files: Optional[list] = None):
        # TODO:video understanding not yet supported by converse API
        # check if any of input["message"][N]["content"][N] has a video
        # can be removed once video understanding is supported by converse API
        logger.info(
            "Checking for video in messages in history", messages=input["messages"]
        )
        for message in input["messages"]:
            for content in message["content"]:
                if Modality.VIDEO.value.lower() in content:
                    logger.info("Found video in messages, invoking native")
                    return self._invoke_native(input, model_kwargs, files)

        logger.info("No video found in messages history, invoking converse")
        return self.converse(input, model_kwargs)

    def _invoke_native(
        self, input: dict, model_kwargs: dict, files: Optional[list] = None
    ):
        logger.info("Incoming request for nova", model_kwargs=model_kwargs)
        logger.info("Mode", mode=self.mode)
        streaming = model_kwargs.get("streaming", False)

        complete_response = ""
        inf_params = {}

        if "temperature" in model_kwargs:
            inf_params["temperature"] = model_kwargs["temperature"]
        if "topP" in model_kwargs:
            inf_params["top_p"] = model_kwargs["topP"]
        if "maxTokens" in model_kwargs:
            inf_params["max_new_tokens"] = model_kwargs["maxTokens"]

        native_request = {
            "schemaVersion": "messages-v1",
            "messages": input["messages"],
            "inferenceConfig": inf_params,
        }
        logger.info("Native request", native_request=native_request)

        if streaming:
            logger.info("Calling invoke_model_with_response_stream")
            response = self.client.invoke_model_with_response_stream(
                modelId=self.model_id, body=json.dumps(native_request)
            )
            request_id = response.get("ResponseMetadata").get("RequestId")
            logger.info(f"Request ID: {request_id}")
            logger.info("Awaiting first token...")
            # Process the response stream
            stream = response.get("body")
            if stream:
                for event in stream:
                    chunk = event.get("chunk")
                    if chunk:
                        chunk_json = json.loads(chunk.get("bytes").decode())
                        content_block_delta = chunk_json.get("contentBlockDelta")
                        if content_block_delta:
                            chunk_text = content_block_delta.get("delta").get("text")
                            self.on_llm_new_token(chunk_text)
                            complete_response += chunk_text

            return {
                "content": complete_response,
            }

        logger.info("Calling invoke_model")
        response = self.client.invoke_model(
            modelId=self.model_id, body=json.dumps(native_request)
        )
        model_response = json.loads(response["body"].read())
        content_text = model_response["output"]["message"]["content"][0]["text"]
        return {
            "content": content_text,
        }

    def generate_image(
        self, input: dict, model_kwargs: dict, files: Optional[list] = None
    ):
        logger.info(
            "Incoming request for nova image generation",
            model_kwargs=model_kwargs,
            input=input,
            files=files,
        )
        logger.info("Mode", mode=self.mode)

        inference_params = {
            "taskType": "TEXT_IMAGE",
            "textToImageParams": {"text": input["last_message"]},
            "imageGenerationConfig": {
                "numberOfImages": 1,
                "width": 1280,
                "height": 768,
                "cfgScale": 7.0,
                "seed": model_kwargs.get("seed", randint(0, 2147483646)),  # nosec B311
            },
        }
        logger.info(
            f"Generating with seed: {inference_params['imageGenerationConfig']['seed']}"
        )
        response = self.client.invoke_model(
            modelId=self.model_id,
            body=json.dumps(inference_params),
        )
        logger.info("Response from nova", response=response)
        logger.info(f"Request ID: {response['ResponseMetadata']['RequestId']}")

        response_body = json.loads(response["body"].read())
        images = response_body["images"]

        if "error" in response_body:
            if not images:
                logger.error("Error: No images generated.")
            logger.error(response_body["error"])

        file_upload = self.upload_file_message(
            base64.b64decode(images[0]), Modality.IMAGE.value
        )
        response = {
            "files": [file_upload],
            "content": "",
        }
        return response

    def generate_video(
        self, input: dict, model_kwargs: dict, files: Optional[list] = None
    ):
        logger.info(
            "Incoming request for nova video generation",
            model_kwargs=model_kwargs,
            input=input,
            files=files,
        )

        text_to_video_params = {
            "text": input["last_message"],
        }

        images = []
        for file in files:
            if file["type"] == Modality.IMAGE.value:
                image_data = self.get_file_message(file)
                media_bytes = image_data["image"]["source"]["bytes"]
                images.append(
                    {
                        "format": image_data["image"]["format"],
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
                "seed": model_kwargs.get("seed", randint(0, 2147483646)),  # nosec B311
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
            "files": [
                {
                    "provider": "s3",
                    "key": video_path,
                    "type": Modality.VIDEO.value,
                }
            ],
            "content": "",
        }


registry.register(r"^bedrock.amazon.nova*", Nova)
