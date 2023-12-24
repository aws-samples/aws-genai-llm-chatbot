import genai_core.types
import genai_core.auth
import genai_core.user_feedback
from pydantic import BaseModel
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler.api_gateway import Router

tracer = Tracer()
router = Router()
logger = Logger()


class CreateUserFeedbackRequest(BaseModel):
    sessionId: str
    key: str
    feedback: str

@router.put("/user-feedback")
@tracer.capture_method
def user_feedback():
    data: dict = router.current_event.json_body
    request = CreateUserFeedbackRequest(**data)

    session_id = request.sessionId
    key = request.key
    feedback = request.feedback

    user_id = genai_core.auth.get_user_id(router)

    if user_id is None:
        raise genai_core.types.CommonError("User not found")

    result = genai_core.user_feedback.add_user_feedback(session_id, user_id, key, feedback)

    return {"ok": True, "data": result}
