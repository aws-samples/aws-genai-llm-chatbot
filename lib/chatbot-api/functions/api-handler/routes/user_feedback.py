import genai_core.types
import genai_core.auth
import genai_core.user_feedback
from pydantic import BaseModel
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler.appsync import Router

tracer = Tracer()
router = Router()
logger = Logger()


class CreateUserFeedbackRequest(BaseModel):
    sessionId: str
    key: str
    feedback: str
    prompt: str
    completion: str
    model: str
    

@router.resolver(field_name="addUserFeedback")
@tracer.capture_method
def user_feedback(input: dict):
    request = CreateUserFeedbackRequest(**input)
        
    userId = genai_core.auth.get_user_id(router)

    if userId is None:
        raise genai_core.types.CommonError("User not found")
    
    result = genai_core.user_feedback.add_user_feedback(
        request.sessionId, request.key, request.feedback, request.prompt, request.completion, request.model, userId)

    return {
        "feedback_id": result["feedback_id"],
    }
