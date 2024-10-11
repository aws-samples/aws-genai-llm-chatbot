import os
import re
import genai_core.clients
from aws_lambda_powertools import Logger
from enum import Enum
from typing import Any, Dict, List
from genai_core.registry import registry
from genai_core.types import ChatbotMode
from genai_core.langchain import WorkspaceRetriever, DynamoDBChatMessageHistory
from langchain.callbacks.base import BaseCallbackHandler
from langchain.chains.conversation.base import ConversationChain
from langchain.chains import ConversationalRetrievalChain
from langchain.chains.retrieval import create_retrieval_chain
from langchain.chains.history_aware_retriever import create_history_aware_retriever
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain.memory import ConversationBufferMemory
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.prompts.prompt import PromptTemplate
from langchain.chains.conversational_retrieval.prompts import (
    QA_PROMPT,
    CONDENSE_QUESTION_PROMPT,
)
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_core.outputs import LLMResult, ChatGeneration
from langchain_core.messages import BaseMessage
from langchain_core.messages.ai import AIMessage, AIMessageChunk
from langchain_core.messages.human import HumanMessage
from langchain_aws import ChatBedrockConverse
from adapters.shared.prompts.system_prompts import (
    prompts,
    locale,
)  # Import prompts and language

logger = Logger()

# Setting programmatic log level
# logger.setLevel("DEBUG")


class Mode(Enum):
    CHAIN = "chain"


def get_guardrails() -> dict:
    if "BEDROCK_GUARDRAILS_ID" in os.environ:
        logger.debug("Guardrails ID found in environment variables.")
        return {
            "guardrailIdentifier": os.environ["BEDROCK_GUARDRAILS_ID"],
            "guardrailVersion": os.environ.get("BEDROCK_GUARDRAILS_VERSION", "DRAFT"),
        }
    logger.info("No guardrails ID found.")
    return {}


class LLMStartHandler(BaseCallbackHandler):
    prompts = []
    usage = None

    # Langchain callbacks
    # https://python.langchain.com/v0.2/docs/concepts/#callbacks
    def on_llm_start(
        self, serialized: Dict[str, Any], prompts: List[str], **kwargs: Any
    ) -> Any:
        self.prompts.append(prompts)

    def on_llm_end(
        self, response: LLMResult, *, run_id, parent_run_id, **kwargs: Any
    ) -> Any:
        generation = response.generations[0][0]  # only one llm request
        if (
            generation is not None
            and isinstance(generation, ChatGeneration)
            and isinstance(generation.message, AIMessage)
        ):
            # In case of rag there could be 2 llm calls.
            if self.usage is None:
                self.usage = {
                    "input_tokens": 0,
                    "output_tokens": 0,
                    "total_tokens": 0,
                }
            self.usage = {
                "input_tokens": self.usage.get("input_tokens", 0)
                + generation.message.usage_metadata.get("input_tokens", 0),
                "output_tokens": self.usage.get("output_tokens", 0)
                + generation.message.usage_metadata.get("output_tokens", 0),
                "total_tokens": self.usage.get("total_tokens", 0)
                + generation.message.usage_metadata.get("total_tokens", 0),
            }


class ModelAdapter:
    def __init__(
        self,
        session_id,
        user_id,
        mode=ChatbotMode.CHAIN.value,
        disable_streaming=False,
        model_kwargs={},
    ):
        self.session_id = session_id
        self.user_id = user_id
        self._mode = mode
        self.model_kwargs = model_kwargs
        self.disable_streaming = disable_streaming

        self.callback_handler = LLMStartHandler()
        self.__bind_callbacks()

        self.chat_history = self.get_chat_history()
        self.llm = self.get_llm(model_kwargs)

    def __bind_callbacks(self):
        callback_methods = [method for method in dir(self) if method.startswith("on_")]
        valid_callback_names = [
            attr for attr in dir(self.callback_handler) if attr.startswith("on_")
        ]

        for method in callback_methods:
            if method in valid_callback_names:
                setattr(self.callback_handler, method, getattr(self, method))

    def get_endpoint(self, model_id):
        clean_name = "SAGEMAKER_ENDPOINT_" + re.sub(r"[\s.\/\-_]", "", model_id).upper()
        if os.getenv(clean_name):
            return os.getenv(clean_name)
        else:
            return model_id

    def get_llm(self, model_kwargs={}):
        raise ValueError("llm must be implemented")

    def get_embeddings_model(self, embeddings):
        raise ValueError("embeddings must be implemented")

    def get_chat_history(self):
        return DynamoDBChatMessageHistory(
            table_name=os.environ["SESSIONS_TABLE_NAME"],
            session_id=self.session_id,
            user_id=self.user_id,
        )

    def get_memory(self, output_key=None, return_messages=False):
        return ConversationBufferMemory(
            memory_key="chat_history",
            chat_memory=self.chat_history,
            return_messages=return_messages,
            output_key=output_key,
        )

    def get_prompt(self):
        template = """The following is a friendly conversation between a human and an AI. If the AI does not know the answer to a question, it truthfully says it does not know.

        Current conversation:
        {chat_history}

        Question: {input}"""  # noqa: E501

        return PromptTemplate.from_template(template)

    def get_condense_question_prompt(self):
        return CONDENSE_QUESTION_PROMPT

    def get_qa_prompt(self):
        return QA_PROMPT

    def run_with_chain_v2(self, user_prompt, workspace_id=None):
        if not self.llm:
            raise ValueError("llm must be set")

        self.callback_handler.prompts = []
        documents = []
        retriever = None

        if workspace_id:
            retriever = WorkspaceRetriever(workspace_id=workspace_id)
            # Only stream the last llm call (otherwise the internal
            # llm response will be visible)
            llm_without_streaming = self.get_llm({"streaming": False})
            history_aware_retriever = create_history_aware_retriever(
                llm_without_streaming,
                retriever,
                self.get_condense_question_prompt(),
            )
            question_answer_chain = create_stuff_documents_chain(
                self.llm,
                self.get_qa_prompt(),
            )
            chain = create_retrieval_chain(
                history_aware_retriever, question_answer_chain
            )
        else:
            chain = self.get_prompt() | self.llm

        conversation = RunnableWithMessageHistory(
            chain,
            lambda session_id: self.chat_history,
            history_messages_key="chat_history",
            input_messages_key="input",
            output_messages_key="output",
        )

        config = {"configurable": {"session_id": self.session_id}}
        try:
            if not self.disable_streaming and self.model_kwargs.get("streaming", False):
                answer = ""
                for chunk in conversation.stream(
                    input={"input": user_prompt}, config=config
                ):
                    logger.debug("chunk", chunk=chunk)
                    if "answer" in chunk:
                        answer = answer + chunk["answer"]
                    elif isinstance(chunk, AIMessageChunk):
                        for c in chunk.content:
                            if "text" in c:
                                answer = answer + c.get("text")
            else:
                response = conversation.invoke(
                    input={"input": user_prompt}, config=config
                )
                if "answer" in response:
                    answer = response.get("answer")  # RAG flow
                else:
                    answer = response.content
        except Exception as e:
            logger.exception(e)
            raise e

        if workspace_id:
            # In the RAG flow, the history is not updated automatically
            self.chat_history.add_message(HumanMessage(user_prompt))
            self.chat_history.add_message(AIMessage(answer))
        if retriever is not None:
            documents = [
                {
                    "page_content": doc.page_content,
                    "metadata": doc.metadata,
                }
                for doc in retriever.get_last_search_documents()
            ]

        metadata = {
            "modelId": self.model_id,
            "modelKwargs": self.model_kwargs,
            "mode": self._mode,
            "sessionId": self.session_id,
            "userId": self.user_id,
            "documents": documents,
            "prompts": self.callback_handler.prompts,
            "usage": self.callback_handler.usage,
        }

        self.chat_history.add_metadata(metadata)

        if (
            self.callback_handler.usage is not None
            and "total_tokens" in self.callback_handler.usage
        ):
            # Used by Cloudwatch filters to generate a metric of token usage.
            logger.info(
                "Usage Metric",
                extra={
                    "model": self.model_id,
                    "metric_type": "token_usage",
                    "value": self.callback_handler.usage.get("total_tokens"),
                },
            )

        return {
            "sessionId": self.session_id,
            "type": "text",
            "content": answer,
            "metadata": metadata,
        }

    def run_with_chain(self, user_prompt, workspace_id=None):
        if not self.llm:
            raise ValueError("llm must be set")

        self.callback_handler.prompts = []

        if workspace_id:
            conversation = ConversationalRetrievalChain.from_llm(
                self.llm,
                WorkspaceRetriever(workspace_id=workspace_id),
                condense_question_llm=self.get_llm({"streaming": False}),
                condense_question_prompt=self.get_condense_question_prompt(),
                combine_docs_chain_kwargs={"prompt": self.get_qa_prompt()},
                return_source_documents=True,
                memory=self.get_memory(output_key="answer", return_messages=True),
                verbose=True,
                callbacks=[self.callback_handler],
            )
            result = conversation({"question": user_prompt})
            logger.debug(result["source_documents"])
            documents = [
                {
                    "page_content": doc.page_content,
                    "metadata": doc.metadata,
                }
                for doc in result["source_documents"]
            ]

            metadata = {
                "modelId": self.model_id,
                "modelKwargs": self.model_kwargs,
                "mode": self._mode,
                "sessionId": self.session_id,
                "userId": self.user_id,
                "workspaceId": workspace_id,
                "documents": documents,
                "prompts": self.callback_handler.prompts,
            }

            self.chat_history.add_metadata(metadata)

            return {
                "sessionId": self.session_id,
                "type": "text",
                "content": result["answer"],
                "metadata": metadata,
            }

        conversation = ConversationChain(
            llm=self.llm,
            prompt=self.get_prompt(),
            memory=self.get_memory(),
            verbose=True,
        )
        answer = conversation.predict(
            input=user_prompt, callbacks=[self.callback_handler]
        )

        metadata = {
            "modelId": self.model_id,
            "modelKwargs": self.model_kwargs,
            "mode": self._mode,
            "sessionId": self.session_id,
            "userId": self.user_id,
            "documents": [],
            "prompts": self.callback_handler.prompts,
        }

        self.chat_history.add_metadata(metadata)

        return {
            "sessionId": self.session_id,
            "type": "text",
            "content": answer,
            "metadata": metadata,
        }

    def run(self, prompt, workspace_id=None, *args, **kwargs):
        logger.debug(f"run with {kwargs}")
        logger.debug(f"workspace_id {workspace_id}")
        logger.debug(f"mode: {self._mode}")

        if self._mode == ChatbotMode.CHAIN.value:
            if isinstance(self.llm, ChatBedrockConverse):
                return self.run_with_chain_v2(prompt, workspace_id)
            else:
                return self.run_with_chain(prompt, workspace_id)

        raise ValueError(f"unknown mode {self._mode}")


class BedrockChatAdapter(ModelAdapter):
    def __init__(self, model_id, *args, **kwargs):
        self.model_id = model_id
        logger.info(f"Initializing BedrockChatAdapter with model_id: {model_id}")
        super().__init__(*args, **kwargs)

    def get_qa_prompt(self):
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

    def get_prompt(self):
        # Fetch the conversation prompt based on the current language
        conversation_prompt = prompts[locale]["conversation_prompt"]
        logger.info("Generating general conversation prompt template.")
        chat_prompt_template = ChatPromptTemplate.from_messages(
            [
                ("system", conversation_prompt),
                MessagesPlaceholder(variable_name="chat_history"),
                ("human", "{input}"),
            ]
        )
        # Trace the ChatPromptTemplate by logging its content
        logger.debug(f"ChatPromptTemplate messages: {chat_prompt_template.messages}")
        return chat_prompt_template

    def get_condense_question_prompt(self):
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

        if temperature:
            params["temperature"] = temperature
        if top_p:
            params["top_p"] = top_p
        if max_tokens:
            params["max_tokens"] = max_tokens

        # Fetch guardrails if any
        guardrails = get_guardrails()
        if len(guardrails.keys()) > 0:
            params["guardrails"] = guardrails

        # Log all parameters in a single log entry, including full guardrails
        logger.info(
            f"Creating LLM chain for model {self.model_id}",
            extra={
                "model_kwargs": model_kwargs,
                "temperature": temperature,
                "top_p": top_p,
                "max_tokens": max_tokens,
                "guardrails": guardrails,
            },
        )

        # Return ChatBedrockConverse instance with the collected params
        return ChatBedrockConverse(
            client=bedrock,
            model=self.model_id,
            disable_streaming=not model_kwargs.get("streaming", True)
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

    def get_prompt(self):
        # Fetch the conversation prompt and translated
        # words based on the current language
        conversation_prompt = prompts[locale]["conversation_prompt"]
        question_word = prompts[locale]["question_word"]
        assistant_word = prompts[locale]["assistant_word"]
        logger.info("Generating no-system-prompt template for conversation.")

        # Combine conversation prompt, chat history, and input into the template
        template = f"""{conversation_prompt}

{question_word}: {{input}}

{assistant_word}:"""

        # Create the PromptTemplateWithHistory instance
        prompt_template = PromptTemplateWithHistory(
            input_variables=["input", "chat_history"], template=template
        )

        # Log the content of PromptTemplateWithHistory before returning
        logger.debug(f"PromptTemplateWithHistory template: {prompt_template.template}")

        return prompt_template

    def get_condense_question_prompt(self):
        # Fetch the prompt and translated words based on the current language
        condense_question_prompt = prompts[locale]["condense_question_prompt"]
        logger.info(f"condense_question_prompt: {condense_question_prompt}")

        follow_up_input_word = prompts[locale]["follow_up_input_word"]
        logger.info(f"follow_up_input_word: {follow_up_input_word}")

        standalone_question_word = prompts[locale]["standalone_question_word"]
        logger.info(f"standalone_question_word: {standalone_question_word}")

        chat_history_word = prompts[locale]["chat_history_word"]
        logger.info(f"chat_history_word: {chat_history_word}")

        logger.info("Generating no-system-prompt template for condensing question.")

        # Combine the prompt with placeholders
        template = f"""{condense_question_prompt}
{chat_history_word}: {{chat_history}}
{follow_up_input_word}: {{input}}
{standalone_question_word}:"""
        # Log the content of template
        logger.info(f"get_condense_question_prompt: Template content: {template}")
        # Create the PromptTemplateWithHistory instance
        prompt_template = PromptTemplateWithHistory(
            input_variables=["input", "chat_history"], template=template
        )

        # Log the content of PromptTemplateWithHistory before returning
        logger.debug(f"PromptTemplateWithHistory template: {prompt_template.template}")

        return prompt_template

    def get_qa_prompt(self):
        # Fetch the QA prompt and translated words based on the current language
        qa_system_prompt = prompts[locale]["qa_prompt"]
        question_word = prompts[locale]["question_word"]
        helpful_answer_word = prompts[locale]["helpful_answer_word"]
        logger.info("Generating no-system-prompt QA template.")

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
        chat_history = kwargs.get("chat_history", "")
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


# Register the adapters
registry.register(r"^bedrock.ai21.jamba*", BedrockChatAdapter)
registry.register(r"^bedrock.ai21.j2*", BedrockChatNoStreamingNoSystemPromptAdapter)
registry.register(r"^bedrock\.cohere\.command-(text|light-text).*", BedrockChatNoSystemPromptAdapter)
registry.register(r"^bedrock\.cohere\.command-r.*", BedrockChatAdapter)
registry.register(r"^bedrock.anthropic.claude*", BedrockChatAdapter)
registry.register(r"^bedrock.meta.llama*", BedrockChatAdapter)
registry.register(r"^bedrock.mistral.mistral-large*", BedrockChatAdapter)
registry.register(r"^bedrock.mistral.mistral-small*", BedrockChatAdapter)
registry.register(r"^bedrock.mistral.mistral-7b-*", BedrockChatNoSystemPromptAdapter)
registry.register(r"^bedrock.mistral.mixtral-*", BedrockChatNoSystemPromptAdapter)
registry.register(r"^bedrock.amazon.titan-t*", BedrockChatNoSystemPromptAdapter)
