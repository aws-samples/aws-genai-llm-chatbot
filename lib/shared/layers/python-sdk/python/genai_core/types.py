from enum import Enum
from typing import Optional

from pydantic import BaseModel


class CommonError(Exception):
    pass


class EmbeddingsModel(BaseModel):
    provider: str
    name: str
    default: Optional[bool] = None
    dimensions: int


class CrossEncoderModel(BaseModel):
    provider: str
    name: str
    default: Optional[bool] = None


class Workspace(BaseModel):
    id: str
    name: str
    engine: str


class Provider(Enum):
    BEDROCK = "bedrock"
    OPENAI = "openai"
    SAGEMAKER = "sagemaker"


class Modality(Enum):
    TEXT = "TEXT"
    IMAGE = "IMAGE"
    EMBEDDING = "EMBEDDING"


class InferenceType(Enum):
    ON_DEMAND = "ON_DEMAND"
    PROVISIONED = "PROVISIONED"


class ModelStatus(Enum):
    ACTIVE = "ACTIVE"
    LEGACY = "LEGACY"

class AgentStatus(Enum):
    PREPARED = "PREPARED"


class ModelInterface(Enum):
    LANGCHAIN = "langchain"
    IDEFICS = "idefics"
    AGENT = "agent"


class Direction(Enum):
    IN = "IN"
    OUT = "OUT"


class ChatbotMode(Enum):
    CHAIN = "chain"


class ChatbotAction(Enum):
    HEARTBEAT = "heartbeat"
    RUN = "run"
    LLM_NEW_TOKEN = "llm_new_token"
    FINAL_RESPONSE = "final_response"
    AGENT_TRACE = "agent_trace"


class ChatbotMessageType(Enum):
    Human = "human"
    AI = "ai"
