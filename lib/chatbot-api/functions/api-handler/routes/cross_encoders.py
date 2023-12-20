import genai_core.types
import genai_core.parameters
import genai_core.cross_encoder
from typing import List
from pydantic import BaseModel
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler.appsync import Router

tracer = Tracer()
router = Router()
logger = Logger()


class CrossEncodersRequest(BaseModel):
    provider: str
    model: str
    reference: str
    passages: List[str]


@router.resolver(field_name="listCrossEncoders")
@tracer.capture_method
def models():
    models = genai_core.cross_encoder.get_cross_encoder_models()

    return models


@router.resolver(field_name="rankPassages")
@tracer.capture_method
def cross_encoders(input: dict):
    request = CrossEncodersRequest(**input)
    selected_model = genai_core.cross_encoder.get_cross_encoder_model(
        request.provider, request.model
    )

    if selected_model is None:
        raise genai_core.types.CommonError("Model not found")

    ret_value = genai_core.cross_encoder.rank_passages(
        selected_model, request.reference, request.passages
    )
    return [{"score": v, "passage": p} for v, p in zip(ret_value, request.passages)]
