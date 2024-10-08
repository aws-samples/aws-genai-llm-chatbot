from aws_lambda_powertools import Logger
from .base import MultiModalModelBase
from genai_core.types import ChatbotMessageType
from urllib.parse import urljoin
import os
from langchain.llms import SagemakerEndpoint
from content_handler import ContentHandler
from genai_core.registry import registry

logger = Logger()


class Idefics(MultiModalModelBase):
    model_id: str

    def __init__(self, model_id: str):
        self.model_id = model_id

    def format_prompt(
        self, prompt: str, messages: list, files: list, user_id: str
    ) -> str:

        human_prompt_template = "User:{prompt}"
        human_prompt_with_image = "User:{prompt}![]({image})"
        ai_prompt_template = "Assistant:{prompt}"

        prompts = []
        for message in messages:
            if message.type.lower() == ChatbotMessageType.Human.value.lower():
                message_files = message.additional_kwargs.get("files", [])
                if not message_files:
                    prompts.append(human_prompt_template.format(prompt=message.content))
                for message_file in message_files:
                    image = urljoin(
                        os.environ["CHATBOT_FILES_PRIVATE_API"],
                        user_id + "/" + message_file["key"],
                    )
                    prompts.append(
                        human_prompt_with_image.format(
                            prompt=message.content,
                            image=image,
                        )
                    )
            if message.type.lower() == ChatbotMessageType.AI.value.lower():
                prompts.append(ai_prompt_template.format(prompt=message.content))

        if not files:
            prompts.append(human_prompt_template.format(prompt=prompt))

        for file in files:
            key = user_id + "/" + file["key"]
            prompts.append(
                human_prompt_with_image.format(
                    prompt=prompt,
                    image=f"{urljoin(os.environ['CHATBOT_FILES_PRIVATE_API'], key)}",
                )
            )

        prompts.append("<end_of_utterance>\nAssistant:")

        prompt_template = "".join(prompts)
        logger.info(prompt_template)
        return prompt_template

    def handle_run(self, prompt: str, model_kwargs: dict):
        logger.info("Incoming request for idefics", model_kwargs=model_kwargs)
        params = {
            "do_sample": True,
            "top_p": 0.2,
            "temperature": 0.4,
            "top_k": 50,
            "max_new_tokens": 512,
            "stop": ["User:", "<end_of_utterance>"],
        }
        if "temperature" in model_kwargs:
            params["temperature"] = model_kwargs["temperature"]
        if "topP" in model_kwargs:
            params["top_p"] = model_kwargs["topP"]
        if "maxTokens" in model_kwargs:
            params["max_new_tokens"] = model_kwargs["maxTokens"]

        mlm = SagemakerEndpoint(
            endpoint_name=self.model_id,
            region_name=os.environ["AWS_REGION"],
            model_kwargs=params,
            content_handler=ContentHandler(),
        )

        mlm_response = mlm.predict(prompt)
        return mlm_response


registry.register(r"^sagemaker.*idefics*", Idefics)
