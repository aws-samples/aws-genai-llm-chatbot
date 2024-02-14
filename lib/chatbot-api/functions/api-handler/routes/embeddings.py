import genai_core.types
import genai_core.parameters
import genai_core.embeddings
from typing import List, Optional
from pydantic import BaseModel
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler.appsync import Router
from genai_core.types import CommonError, Task

tracer = Tracer()
router = Router()
logger = Logger()


class EmbeddingsRequest(BaseModel):
    provider: str
    model: str
    passages: List[str]
    task: Optional[Task] = Task.STORE


@router.resolver(field_name="listEmbeddingModels")
@tracer.capture_method
def models():
    models = genai_core.embeddings.get_embeddings_models()

    return models


@router.resolver(field_name="calculateEmbeddings")
@tracer.capture_method
def embeddings(input: dict):
    request = EmbeddingsRequest(**input)
    selected_model = genai_core.embeddings.get_embeddings_model(
        request.provider, request.model
    )

    if selected_model is None:
        raise CommonError("Model not found")

    ret_value = genai_core.embeddings.generate_embeddings(
        selected_model, request.passages, request.task
    )

    return [
        {"vector": v, "passage": request.passages[idx]}
        for idx, v in enumerate(ret_value)
    ]