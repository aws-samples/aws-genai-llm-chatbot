import os
from enum import Enum
from urllib.parse import urlparse

import boto3

from aws_lambda_powertools import Logger, Tracer
from aws_requests_auth.aws_auth import AWSRequestsAuth
from langchain.callbacks.base import BaseCallbackHandler
from langchain.chains import ConversationalRetrievalChain, ConversationChain, LLMChain
from langchain.memory import ConversationBufferMemory
from langchain.prompts.prompt import PromptTemplate
from langchain.chains.conversational_retrieval.prompts import QA_PROMPT, CONDENSE_QUESTION_PROMPT


from .chat_message_histories import DynamoDBChatMessageHistory
from .remote_retriever import RemoteRetriever

logger = Logger()


class Mode(Enum):
    CHAIN = "chain"


class ModelAdapter:
    def __init__(self, session_id, user_id, mode="chain", model_kwargs={}):
        self.session_id = session_id
        self.user_id = user_id
        self._mode = mode
        self.model_kwargs = model_kwargs

        self.llm = self.get_llm(model_kwargs)
        self.chat_history = self.get_chat_history()

        self.callback_handler = BaseCallbackHandler()
        self.__bind_callbacks()

    def __bind_callbacks(self):
        callback_methods = [method for method in dir(self) if method.startswith("on_")]
        valid_callback_names = [
            attr for attr in dir(self.callback_handler) if attr.startswith("on_")
        ]

        for method in callback_methods:
            if method in valid_callback_names:
                setattr(self.callback_handler, method, getattr(self, method))

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

    def get_memory(self, output_key=None):
        return ConversationBufferMemory(
            memory_key="chat_history",
            chat_memory=self.chat_history,
            return_messages=True,
            output_key=output_key,
        )

    def get_prompt(self):
        template = """The following is a friendly conversation between a human and an AI. If the AI does not know the answer to a question, it truthfully says it does not know.

        Current conversation:
        {chat_history}

        Question: {input}"""
        input_variables = ["input", "chat_history"]
        prompt_template_args = {
            "chat_history": "{chat_history}",
            "input_variables": input_variables,
            "template": template,
        }
        prompt_template = PromptTemplate(**prompt_template_args)

        return prompt_template
    
    def get_condense_question_prompt(self):
        return CONDENSE_QUESTION_PROMPT

    def get_qa_prompt(self):
        return QA_PROMPT

    def get_retriever(self, source):
        session = boto3.Session()
        credentials = session.get_credentials()
        rag_source_env_var = f"RAG_SOURCE_{source.upper()}"

        if not rag_source_env_var in os.environ:
            raise ValueError(
                f"unsupported RAG source {source} or API endpoint is not defined in LAMBDA ENV Vars"
            )

        url = os.environ[rag_source_env_var]
        host = urlparse(url).hostname
        logger.info(host)
        auth = AWSRequestsAuth(
            aws_access_key=credentials.access_key,
            aws_secret_access_key=credentials.secret_key,
            aws_token=credentials.token,
            aws_host=host,
            aws_region=os.environ["AWS_REGION"],
            aws_service="execute-api",
        )

        logger.info(auth)
        return RemoteRetriever(
            url=url,
            auth=auth,
        )

    def run_with_chain(self, user_prompt, rag_source=None):
        if not self.llm:
            raise ValueError("llm must be set")

        if rag_source:
            conversation = ConversationalRetrievalChain.from_llm(
                self.llm,
                self.get_retriever(rag_source.lower()),
                condense_question_prompt=self.get_condense_question_prompt(),
                combine_docs_chain_kwargs={"prompt": self.get_qa_prompt()},
                return_source_documents=True,
                memory=self.get_memory(output_key="answer"),
                verbose=True,
            )
            result = conversation({"question": user_prompt})
            logger.info(result["source_documents"])
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
                "rag_source": rag_source,
                "source_documents": documents,
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
        }

        self.chat_history.add_metadata(metadata)
        return {
            "sessionId": self.session_id,
            "type": "text",
            "content": answer,
            "metadata": metadata,
        }

    def run(self, prompt, rag_source=None, *args, **kwargs):
        logger.debug(f"run with {kwargs}")
        logger.debug(f"rag_source {rag_source}")
        logger.debug(f"mode: {self._mode}")

        if self._mode == "chain":
            return self.run_with_chain(prompt, rag_source)

        raise ValueError(f"unknown mode {self._mode}")
