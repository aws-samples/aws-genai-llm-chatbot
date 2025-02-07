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


class WorkspaceStatus(Enum):
    SUBMITTED = "submitted"
    READY = "ready"
    CREATING = "creating"


class Provider(Enum):
    BEDROCK = "bedrock"
    OPENAI = "openai"
    AZURE_OPENAI = "azure.openai"
    SAGEMAKER = "sagemaker"
    AMAZON = "amazon"
    COHERE = "cohere"


class Modality(Enum):
    TEXT = "TEXT"
    IMAGE = "IMAGE"
    EMBEDDING = "EMBEDDING"
    VIDEO = "VIDEO"


class InferenceType(Enum):
    ON_DEMAND = "ON_DEMAND"
    PROVISIONED = "PROVISIONED"
    INFERENCE_PROFILE = "INFERENCE_PROFILE"


class ModelStatus(Enum):
    ACTIVE = "ACTIVE"
    LEGACY = "LEGACY"


class ModelInterface(Enum):
    LANGCHAIN = "langchain"
    IDEFICS = "idefics"


class Direction(Enum):
    IN = "IN"
    OUT = "OUT"


class ChatbotMode(Enum):
    CHAIN = "chain"
    IMAGE_GENERATION = "image_generation"
    VIDEO_GENERATION = "video_generation"


class ChatbotAction(Enum):
    HEARTBEAT = "heartbeat"
    RUN = "run"
    LLM_NEW_TOKEN = "llm_new_token"  # nosec B105 False positive, this is not password
    FINAL_RESPONSE = "final_response"


class ChatbotMessageType(Enum):
    Human = "human"
    AI = "ai"


class Task(Enum):
    STORE = "store"
    RETRIEVE = "retrieve"
    SEARCH_QUERY = "search_query"
    SEARCH_DOCUMENT = "search_document"


class FileStorageProvider(Enum):
    S3 = "s3"
