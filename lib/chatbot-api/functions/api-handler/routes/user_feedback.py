from common.constant import (
    SAFE_STR_REGEX,
    ID_FIELD_VALIDATION,
    MAX_STR_INPUT_LENGTH,
)
import genai_core.types
import genai_core.auth
import genai_core.user_feedback
from pydantic import BaseModel, Field
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler.appsync import Router

from routes.applications import IdValidation

tracer = Tracer()
router = Router()
logger = Logger()


class CreateUserFeedbackRequest(BaseModel):
    sessionId: str = ID_FIELD_VALIDATION
    key: int = Field(ge=0, le=8192)
    feedback: str = Field(min_length=1, max_length=500, pattern=SAFE_STR_REGEX)
    prompt: str = Field(min_length=0, max_length=MAX_STR_INPUT_LENGTH)
    completion: str = Field(min_length=1, max_length=MAX_STR_INPUT_LENGTH)
    model: str = Field(None, min_length=1, max_length=500, pattern=SAFE_STR_REGEX)
    applicationId: str = Field(
        None, min_length=1, max_length=500, pattern=SAFE_STR_REGEX
    )


@router.resolver(field_name="addUserFeedback")
@tracer.capture_method
def user_feedback(input: dict):
    applicationId = input.get("applicationId")
    if applicationId:
        IdValidation(**{"id": applicationId})
        user_roles = genai_core.auth.get_user_roles(router)
        if user_roles is None:
            raise genai_core.types.CommonError("User does not have any roles")

        userId = genai_core.auth.get_user_id(router)
        if userId is None:
            raise genai_core.types.CommonError("User not found")

        app = genai_core.applications.get_application(applicationId)
        input["model"] = app.get("Model")
        request = CreateUserFeedbackRequest(**input)
    else:
        request = CreateUserFeedbackRequest(**input)
        userId = genai_core.auth.get_user_id(router)
        if userId is None:
            raise genai_core.types.CommonError("User not found")

    result = genai_core.user_feedback.add_user_feedback(
        request.sessionId,
        request.key,
        request.feedback,
        request.prompt,
        request.completion,
        request.model,
        userId,
    )

    return {
        "feedback_id": result["feedback_id"],
    }
