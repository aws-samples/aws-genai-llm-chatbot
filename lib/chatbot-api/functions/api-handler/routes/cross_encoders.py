import genai_core.types
import genai_core.parameters
import genai_core.cross_encoder
from typing import List
from pydantic import BaseModel
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler.api_gateway import Router

tracer = Tracer()
router = Router()
logger = Logger()


class CrossEncodersRequest(BaseModel):
    provider: str
    model: str
    input: str
    passages: List[str]


@router.get("/cross-encoders/models")
@tracer.capture_method
def models():
    models = genai_core.cross_encoder.get_cross_encoder_models()

    return {"ok": True, "data": models}


@router.post("/cross-encoders")
@tracer.capture_method
def cross_encoders():
    data: dict = router.current_event.json_body
    request = CrossEncodersRequest(**data)
    selected_model = genai_core.cross_encoder.get_cross_encoder_model(
        request.provider, request.model
    )

    if selected_model is None:
        raise genai_core.types.CommonError("Model not found")

    ret_value = genai_core.cross_encoder.rank_passages(
        selected_model, request.input, request.passages
    )
    return {"ok": True, "data": ret_value}
