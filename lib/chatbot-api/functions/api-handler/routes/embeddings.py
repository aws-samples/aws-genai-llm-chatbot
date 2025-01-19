from common.constant import MAX_STR_INPUT_LENGTH, SAFE_STR_REGEX
import genai_core.types
import genai_core.parameters
import genai_core.embeddings
from typing import Annotated, List, Optional
from pydantic import BaseModel, Field
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler.appsync import Router
from genai_core.types import CommonError, Task
from genai_core.auth import UserPermissions

tracer = Tracer()
router = Router()
logger = Logger()
permissions = UserPermissions(router)


class EmbeddingsRequest(BaseModel):
    provider: str = Field(min_length=1, max_length=500, pattern=SAFE_STR_REGEX)
    model: str = Field(min_length=1, max_length=500, pattern=r"^[A-Za-z0-9-_. /]*$")
    passages: List[Annotated[str, Field(min_length=1, max_length=MAX_STR_INPUT_LENGTH)]]
    task: Optional[Task] = Task.STORE


@router.resolver(field_name="listEmbeddingModels")
@tracer.capture_method
@permissions.approved_roles(
    [permissions.ADMIN_ROLE, permissions.WORKSPACES_MANAGER_ROLE]
)
def models():
    models = genai_core.embeddings.get_embeddings_models()

    return models


@router.resolver(field_name="calculateEmbeddings")
@tracer.capture_method
@permissions.approved_roles(
    [permissions.ADMIN_ROLE, permissions.WORKSPACES_MANAGER_ROLE]
)
def embeddings(input: dict):
    request = EmbeddingsRequest(**input)
    if len(request.passages) == 0:
        raise genai_core.types.CommonError("Passages is empty")

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
