import os
import re
import mimetypes
import genai_core.clients
from aws_lambda_powertools import Logger
from typing import Any, List, Optional
import boto3
from adapters.base import ModelAdapter
from langchain_core.messages import BaseMessage
from langchain_core.messages.ai import AIMessage
from langchain_core.messages.human import HumanMessage
from langchain_aws import ChatBedrockConverse
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.prompts.prompt import PromptTemplate
from adapters.shared.prompts.system_prompts import (
    prompts,
    locale,
)  # Import prompts and language

logger = Logger()
s3 = boto3.resource("s3")


class BedrockChatAdapter(ModelAdapter):
    def __init__(self, model_id, *args, **kwargs):
        self.model_id = model_id
        logger.info(f"Initializing BedrockChatAdapter with model_id: {model_id}")
        super().__init__(*args, **kwargs)

    def should_call_apply_bedrock_guardrails(self) -> bool:
        guardrails = self.get_bedrock_guardrails()
        # Here are listed the models that do not support guardrails with the converse api # noqa
        # Fall back to using the ApplyGuardrail API
        # https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference-supported-models-features.html # noqa
        if re.match(r"^bedrock.ai21.jamba*", self.model_id) or re.match(
            r"^bedrock\.cohere\.command-r.*", self.model_id
        ):
            return True and len(guardrails.keys()) > 0
        else:
            return False

    def add_files_to_message_history(self, images=[], documents=[], videos=[]):
        for image in images:
            filename, file_extension = os.path.splitext(image["key"])
            file_extension = file_extension.lower().replace(".", "")
            if file_extension == "jpg" or file_extension == "jpeg":
                file_extension = "jpeg"
            elif file_extension != "png":
                # https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_ImageBlock.html
                raise Exception("Unsupported format " + file_extension)

            self.chat_history.add_temporary_message(
                HumanMessage(
                    content=[
                        {
                            "type": "image",
                            "image": {
                                "format": file_extension,
                                "source": {
                                    "bytes": self.get_file_from_s3(image)["source"][
                                        "bytes"
                                    ]
                                },
                            },
                        }
                    ]
                )
            )

        i = 0
        for document in documents:
            i = i + 1
            filename, file_extension = os.path.splitext(document["key"])
            file_extension = file_extension.lower().replace(".", "")
            supported = [
                "pdf",
                "csv",
                "doc",
                "docx",
                "xls",
                "xlsx",
                "html",
                "txt",
                "md",
            ]
            if file_extension not in supported:
                # https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_DocumentBlock.html
                raise Exception("Unsupported format " + file_extension)
            self.chat_history.add_temporary_message(
                HumanMessage(
                    content=[
                        {
                            "type": "document",
                            "document": {
                                "format": file_extension,
                                "name": "input-document-"
                                + str(i),  # Generic name as suggested by the doc above
                                "source": {
                                    "bytes": self.get_file_from_s3(document)["source"][
                                        "bytes"
                                    ]
                                },
                            },
                        }
                    ]
                )
            )

        # Add videos to message history - applied to models with video input modality
        for video in videos:
            filename, file_extension = os.path.splitext(video["key"])
            file_extension = file_extension.lower().replace(".", "")
            if file_extension != "mp4":
                # https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_VideoBlock.html
                raise Exception("Unsupported format " + file_extension)
            self.chat_history.add_temporary_message(
                HumanMessage(
                    content=[
                        {
                            "type": "video",
                            "video": {
                                "format": "mp4",
                                "source": {
                                    "bytes": self.get_file_from_s3(video)["source"][
                                        "bytes"
                                    ]
                                },
                            },
                        }
                    ]
                )
            )
        return

    def get_file_from_s3(
        self,
        file: dict,
        use_s3_path: Optional[bool] = False,
    ):
        if file["key"] is None:
            raise Exception("Invalid S3 Key " + file["key"])

        key = "private/" + self.user_id + "/" + file["key"]
        logger.info(
            "Fetching file", bucket=os.environ["CHATBOT_FILES_BUCKET_NAME"], key=key
        )
        extension = mimetypes.guess_extension(file["key"]) or file["key"].split(".")[-1]
        mime_type = mimetypes.guess_type(file["key"])[0] or ""
        file_type = mime_type.split("/")[0]
        logger.info("File type", file_type=file_type)
        logger.info("File extension", extension=extension)
        logger.info("File mime type", mime_type=mime_type)
        format = mime_type.split("/")[-1] or extension

        response = s3.Object(os.environ["CHATBOT_FILES_BUCKET_NAME"], key)  # noqa
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
            "format": format,
            "source": source,
            "type": file_type,
        }

    def get_qa_prompt(self, custom_prompt=None):
        if custom_prompt:
            qa_system_prompt_with_context = custom_prompt + "\n\n{context}"
        else:
            # Fetch the QA prompt based on the current language
            qa_system_prompt = prompts[locale]["qa_prompt"]
            # Append the context placeholder if needed
            qa_system_prompt_with_context = qa_system_prompt + "\n\n{context}"
            logger.info(
                f"Generating QA prompt template with: {qa_system_prompt_with_context}"
            )

        # Create the ChatPromptTemplate
        chat_prompt_template = ChatPromptTemplate.from_messages(
            [
                ("system", qa_system_prompt_with_context),
                MessagesPlaceholder("chat_history"),
                ("human", "{input}"),
            ]
        )

        # Trace the ChatPromptTemplate by logging its content
        logger.debug(f"ChatPromptTemplate messages: {chat_prompt_template.messages}")

        return chat_prompt_template

    def get_prompt(self, custom_prompt=None):
        if custom_prompt:
            system_prompt = custom_prompt
        else:
            # Fetch the conversation prompt based on the current language
            system_prompt = prompts[locale]["conversation_prompt"]
        logger.info("Generating general conversation prompt template.")

        prompt_template = ChatPromptTemplate(
            [
                ("system", system_prompt),
                MessagesPlaceholder(variable_name="chat_history"),
                ("human", "{input}"),
            ]
        )
        # Trace the ChatPromptTemplate by logging its content
        logger.debug(f"ChatPromptTemplate messages: {prompt_template.messages}")
        return prompt_template

    def get_condense_question_prompt(self, custom_prompt=None):
        if custom_prompt:
            condense_question_prompt = custom_prompt
        else:
            # Fetch the prompt based on the current language
            condense_question_prompt = prompts[locale]["condense_question_prompt"]
            logger.info("Generating condense question prompt template.")

        chat_prompt_template = ChatPromptTemplate.from_messages(
            [
                ("system", condense_question_prompt),
                MessagesPlaceholder("chat_history"),
                ("human", "{input}"),
            ]
        )
        # Trace the ChatPromptTemplate by logging its content
        logger.debug(f"ChatPromptTemplate messages: {chat_prompt_template.messages}")
        return chat_prompt_template

    def get_llm(self, model_kwargs={}, extra={}):
        bedrock = genai_core.clients.get_bedrock_client()
        params = {}

        # Collect temperature, topP, and maxTokens if available
        temperature = model_kwargs.get("temperature")
        top_p = model_kwargs.get("topP")
        max_tokens = model_kwargs.get("maxTokens")

        if temperature is not None:
            params["temperature"] = temperature
        if top_p:
            params["top_p"] = top_p
        if max_tokens:
            params["max_tokens"] = max_tokens

        # Fetch guardrails if any
        guardrails = self.get_bedrock_guardrails()
        if len(guardrails.keys()) > 0:
            params["guardrails"] = guardrails

        # Log all parameters in a single log entry, including full guardrails
        logger.info(
            f"Creating LLM chain for model {self.model_id}",
            model_kwargs=model_kwargs,
            temperature=temperature,
            top_p=top_p,
            max_tokens=max_tokens,
            guardrails=guardrails,
        )

        # Return ChatBedrockConverse instance with the collected params
        return ChatBedrockConverse(
            client=bedrock,
            model=self.model_id,
            disable_streaming=model_kwargs.get("streaming", False) == False
            or self.disable_streaming,
            callbacks=[self.callback_handler],
            **params,
            **extra,
        )


class BedrockChatNoStreamingAdapter(BedrockChatAdapter):
    """Some models do not support system streaming using the converse API"""

    def __init__(self, *args, **kwargs):
        logger.info(
            "Initializing BedrockChatNoStreamingAdapter with disabled streaming."
        )
        super().__init__(disable_streaming=True, *args, **kwargs)


class BedrockChatNoSystemPromptAdapter(BedrockChatAdapter):
    """Some models do not support system and message history in the conversation API"""

    def get_prompt(self, custom_prompt=None):
        if custom_prompt:
            conversation_prompt = custom_prompt
        else:
            # Fetch the conversation prompt and translated
            # words based on the current language
            conversation_prompt = prompts[locale]["conversation_prompt"]
        question_word = prompts[locale]["question_word"]
        assistant_word = prompts[locale]["assistant_word"]
        logger.info("Generating no-system-prompt template for conversation.")

        # Combine conversation prompt, chat history, and input into the template
        template = f"""{conversation_prompt}

{{chat_history}}

{question_word}: {{input}}

{assistant_word}:"""

        # Create the PromptTemplateWithHistory instance
        prompt_template = PromptTemplateWithHistory(
            input_variables=["input", "chat_history"], template=template
        )

        # Log the content of PromptTemplateWithHistory before returning
        logger.debug(f"PromptTemplateWithHistory template: {prompt_template.template}")

        return prompt_template

    def get_condense_question_prompt(self, custom_prompt=None):
        if custom_prompt:
            condense_question_prompt = custom_prompt
        else:
            # Fetch the prompt and translated words based on the current language
            condense_question_prompt = prompts[locale]["condense_question_prompt"]
        logger.debug(f"condense_question_prompt: {condense_question_prompt}")

        follow_up_input_word = prompts[locale]["follow_up_input_word"]
        logger.debug(f"follow_up_input_word: {follow_up_input_word}")

        standalone_question_word = prompts[locale]["standalone_question_word"]
        logger.debug(f"standalone_question_word: {standalone_question_word}")

        chat_history_word = prompts[locale]["chat_history_word"]
        logger.debug(f"chat_history_word: {chat_history_word}")

        logger.debug("Generating no-system-prompt template for condensing question.")

        # Combine the prompt with placeholders
        template = f"""{condense_question_prompt}
{chat_history_word}: {{chat_history}}
{follow_up_input_word}: {{input}}
{standalone_question_word}:"""
        # Log the content of template
        logger.debug(f"get_condense_question_prompt: Template content: {template}")
        # Create the PromptTemplateWithHistory instance
        prompt_template = PromptTemplateWithHistory(
            input_variables=["input", "chat_history"], template=template
        )

        # Log the content of PromptTemplateWithHistory before returning
        logger.debug(f"PromptTemplateWithHistory template: {prompt_template.template}")

        return prompt_template

    def get_qa_prompt(self, custom_prompt=None):
        if custom_prompt:
            qa_system_prompt = custom_prompt
        else:
            # Fetch the QA prompt and translated words based on the current language
            qa_system_prompt = prompts[locale]["qa_prompt"]
        question_word = prompts[locale]["question_word"]
        helpful_answer_word = prompts[locale]["helpful_answer_word"]
        logger.info("Generating no-system-prompt QA template.")

        # Append the context placeholder if needed

        # Combine the prompt with placeholders
        template = f"""{qa_system_prompt}

{{context}}

{question_word}: {{input}}
{helpful_answer_word}:"""

        # Create the PromptTemplateWithHistory instance
        prompt_template = PromptTemplateWithHistory(
            input_variables=["input", "context"], template=template
        )

        # Log the content of PromptTemplateWithHistory before returning
        logger.debug(f"PromptTemplateWithHistory template: {prompt_template.template}")

        return prompt_template


class BedrockChatNoStreamingNoSystemPromptAdapter(BedrockChatNoSystemPromptAdapter):
    """Some models do not support system streaming using the converse API"""

    def __init__(self, *args, **kwargs):
        super().__init__(disable_streaming=True, *args, **kwargs)


class PromptTemplateWithHistory(PromptTemplate):
    def format(self, **kwargs: Any) -> str:
        chat_history = kwargs["chat_history"]
        if isinstance(chat_history, List):
            # RunnableWithMessageHistory is provided a list of BaseMessage as a history
            # Since this model does not support history, we format the common prompt to
            # list the history
            chat_history_str = ""
            for message in chat_history:
                if isinstance(message, BaseMessage) and isinstance(
                    message.content, str
                ):
                    prefix = ""
                    if isinstance(message, AIMessage):
                        prefix = "AI: "
                    elif isinstance(message, HumanMessage):
                        prefix = "Human: "
                    chat_history_str += prefix + message.content + "\n"
            kwargs["chat_history"] = chat_history_str
        return super().format(**kwargs)
