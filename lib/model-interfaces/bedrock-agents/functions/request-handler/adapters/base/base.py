import os
from enum import Enum
from aws_lambda_powertools import Logger
from typing import Optional, Iterator
import boto3
from genai_core.langchain import WorkspaceRetriever, DynamoDBChatMessageHistory
from genai_core.types import ChatbotMode
from pydantic import BaseModel
from abc import abstract

logger = Logger()


class Mode(Enum):
    AGENT = "agent"


class AgentAdapter(BaseModel):
    agent_id: str
    session_id: str
    user_id: str
    region: Optional[str] = None
    mode: Mode = Mode.AGENT

    def get_chat_history(self):
        return DynamoDBChatMessageHistory(
            table_name=os.environ["SESSIONS_TABLE_NAME"],
            session_id=self.session_id,
            user_id=self.user_id,
        )

    def run(self, prompt):
        logger.debug(f"run with {kwargs}")
        logger.debug(f"mode: {self._mode}")

        if self._mode == ChatbotMode.AGENT.value:
            return self._invoke_agent(
                enableTrace=True,
                inputText=prompt,
                sessionId=self.session_id,
                agentId=self.agent_id,
                agentAliasId=self.agent_alias_id,
            )

        raise ValueError(f"unknown mode {self._mode}")

    @abstract
    def _invoke_agent(self, prompt: str, session_id: str) -> Iterator[str]:
        ...
