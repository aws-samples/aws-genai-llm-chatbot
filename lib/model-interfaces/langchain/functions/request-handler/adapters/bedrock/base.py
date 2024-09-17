import os
from typing import Any, List

from ..base import ModelAdapter
from genai_core.registry import registry
import genai_core.clients

from aws_lambda_powertools import Logger

from langchain_core.messages import BaseMessage
from langchain_core.messages.ai import AIMessage
from langchain_core.messages.human import HumanMessage
from langchain_aws import ChatBedrockConverse
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.prompts.prompt import PromptTemplate

logger = Logger()


def get_guardrails() -> dict:
    if "BEDROCK_GUARDRAILS_ID" in os.environ:
        return {
            "guardrailIdentifier": os.environ["BEDROCK_GUARDRAILS_ID"],
            "guardrailVersion": os.environ.get("BEDROCK_GUARDRAILS_VERSION", "DRAFT"),
        }
    return {}


class BedrockChatAdapter(ModelAdapter):
    def __init__(self, model_id, *args, **kwargs):
        self.model_id = model_id

        super().__init__(*args, **kwargs)

    def get_qa_prompt(self):
        system_prompt = (
            "Use the following pieces of context to answer the question at the end."
            " If you don't know the answer, just say that you don't know, "
            "don't try to make up an answer. \n\n{context}"
        )
        return ChatPromptTemplate.from_messages(
            [
                ("system", system_prompt),
                MessagesPlaceholder("chat_history"),
                ("human", "{input}"),
            ]
        )

    def get_prompt(self):
        prompt_template = ChatPromptTemplate(
            [
                (
                    "system",
                    (
                        "The following is a friendly conversation between "
                        "a human and an AI."
                        "If the AI does not know the answer to a question, it "
                        "truthfully says it does not know."
                    ),
                ),
                MessagesPlaceholder(variable_name="chat_history"),
                ("human", "{input}"),
            ]
        )

        return prompt_template

    def get_condense_question_prompt(self):
        contextualize_q_system_prompt = (
            "Given the following conversation and a follow up"
            " question, rephrase the follow up question to be a standalone question."
        )
        return ChatPromptTemplate.from_messages(
            [
                ("system", contextualize_q_system_prompt),
                MessagesPlaceholder("chat_history"),
                ("human", "{input}"),
            ]
        )

    def get_llm(self, model_kwargs={}, extra={}):
        bedrock = genai_core.clients.get_bedrock_client()
        params = {}
        if "temperature" in model_kwargs:
            params["temperature"] = model_kwargs["temperature"]
        if "topP" in model_kwargs:
            params["top_p"] = model_kwargs["topP"]
        if "maxTokens" in model_kwargs:
            params["max_tokens"] = model_kwargs["maxTokens"]

        guardrails = get_guardrails()
        if len(guardrails.keys()) > 0:
            params["guardrails"] = guardrails

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
        super().__init__(disable_streaming=True, *args, **kwargs)


class BedrockChatNoSystemPromptAdapter(BedrockChatAdapter):
    """Some models do not support system and message history in the conversion API"""

    def get_prompt(self):
        template = """The following is a friendly conversation between a human and an AI. If the AI does not know the answer to a question, it truthfully says it does not know.

Current conversation:
{chat_history}

Question: {input}

Assistant:"""  # noqa: E501
        return PromptTemplateWithHistory(
            template=template, input_variables=["input", "chat_history"]
        )

    def get_condense_question_prompt(self):
        template = """Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question, in its original language.

Chat History:
{chat_history}
Follow Up Input: {input}
Standalone question:"""  # noqa: E501
        return PromptTemplateWithHistory(
            template=template, input_variables=["input", "chat_history"]
        )

    def get_qa_prompt(self):
        template = """Use the following pieces of context to answer the question at the end. If you don't know the answer, just say that you don't know, don't try to make up an answer.

{context}

Question: {input}
Helpful Answer:"""  # noqa: E501
        return PromptTemplateWithHistory(
            template=template, input_variables=["input", "content"]
        )


class BedrockChatNoStreamingNoSystemPromptAdapter(BedrockChatNoSystemPromptAdapter):
    """Some models do not support system streaming using the converse API"""

    def __init__(self, *args, **kwargs):
        super().__init__(disable_streaming=True, *args, **kwargs)


# Register the adapters
registry.register(r"^bedrock.ai21.jamba*", BedrockChatAdapter)
registry.register(r"^bedrock.ai21.j2*", BedrockChatNoStreamingNoSystemPromptAdapter)
registry.register(
    r"^bedrock\.cohere\.command-(text|light-text).*", BedrockChatNoSystemPromptAdapter
)
registry.register(r"^bedrock\.cohere\.command-r.*", BedrockChatAdapter)
registry.register(r"^bedrock.anthropic.claude*", BedrockChatAdapter)
registry.register(
    r"^bedrock.meta.llama*",
    BedrockChatAdapter,
)
registry.register(
    r"^bedrock.mistral.mistral-large*",
    BedrockChatAdapter,
)
registry.register(
    r"^bedrock.mistral.mistral-small*",
    BedrockChatAdapter,
)
registry.register(
    r"^bedrock.mistral.mistral-7b-*",
    BedrockChatNoSystemPromptAdapter,
)
registry.register(
    r"^bedrock.mistral.mixtral-*",
    BedrockChatNoSystemPromptAdapter,
)
registry.register(r"^bedrock.amazon.titan-t*", BedrockChatNoSystemPromptAdapter)


class PromptTemplateWithHistory(PromptTemplate):
    def format(self, **kwargs: Any) -> str:
        chat_history = kwargs["chat_history"]
        if isinstance(chat_history, List):
            # RunnableWithMessageHistory is provided a list of BaseMessage as a history
            # Since this model does not support history, we format the common prompt to
            # list the history
            chat_history_str = ""
            for message in chat_history:
                if isinstance(message, BaseMessage):
                    prefix = ""
                    if isinstance(message, AIMessage):
                        prefix = "AI: "
                    elif isinstance(message, HumanMessage):
                        prefix = "Human: "
                    chat_history_str += prefix + message.content + "\n"
            kwargs["chat_history"] = chat_history_str
        return super().format(**kwargs)
