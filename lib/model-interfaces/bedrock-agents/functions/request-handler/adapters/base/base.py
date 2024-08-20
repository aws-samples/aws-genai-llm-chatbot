import os
from enum import Enum
from aws_lambda_powertools import Logger
from typing import Optional, Iterator
from genai_core.langchain import DynamoDBChatMessageHistory
from pydantic import BaseModel
from abc import abstractmethod

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

    def run(self, prompt: str) -> Iterator[str]:
        return self._invoke_agent(
            prompt=prompt,
        )

    @abstractmethod
    def _invoke_agent(self, prompt: str, session_id: str) -> Iterator[str]: ...
