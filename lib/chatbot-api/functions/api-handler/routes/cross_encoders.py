from common.constant import MAX_STR_INPUT_LENGTH, SAFE_STR_REGEX
import genai_core.types
import genai_core.parameters
import genai_core.cross_encoder
from typing import Annotated, List
from pydantic import BaseModel, Field
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler.appsync import Router
from genai_core.auth import UserPermissions

tracer = Tracer()
router = Router()
logger = Logger()
permissions = UserPermissions(router)


class CrossEncodersRequest(BaseModel):
    provider: str = Field(min_length=1, max_length=500, pattern=SAFE_STR_REGEX)
    model: str = Field(min_length=1, max_length=500, pattern=r"^[A-Za-z0-9-_. /]*$")
    reference: str = Field(min_length=1, max_length=MAX_STR_INPUT_LENGTH)
    passages: List[Annotated[str, Field(min_length=1, max_length=MAX_STR_INPUT_LENGTH)]]


@router.resolver(field_name="listCrossEncoders")
@tracer.capture_method
@permissions.approved_roles(
    [permissions.ADMIN_ROLE, permissions.WORKSPACES_MANAGER_ROLE]
)
def models():
    models = genai_core.cross_encoder.get_cross_encoder_models()

    return models


@router.resolver(field_name="rankPassages")
@tracer.capture_method
@permissions.approved_roles(
    [permissions.ADMIN_ROLE, permissions.WORKSPACES_MANAGER_ROLE]
)
def cross_encoders(input: dict):
    request = CrossEncodersRequest(**input)
    if len(request.passages) < 1:
        raise genai_core.types.CommonError("Passages is empty")

    selected_model = genai_core.cross_encoder.get_cross_encoder_model(
        request.provider, request.model
    )

    if selected_model is None:
        raise genai_core.types.CommonError("Model not found")

    ret_value = genai_core.cross_encoder.rank_passages(
        selected_model, request.reference, request.passages
    )
    return [{"score": v, "passage": p} for v, p in zip(ret_value, request.passages)]
