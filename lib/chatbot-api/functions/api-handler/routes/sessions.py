from pydantic import BaseModel, Field
from common.constant import SAFE_STR_REGEX
from common.validation import WorkspaceIdValidation
import genai_core.presign
import genai_core.sessions
import genai_core.types
import genai_core.auth
import genai_core.utils.json
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler.appsync import Router
import json

tracer = Tracer()
router = Router()
logger = Logger()


class FileURequestValidation(BaseModel):
    fileName: str = Field(min_length=1, max_length=500, pattern=SAFE_STR_REGEX)


@router.resolver(field_name="getFileURL")
@tracer.capture_method
def get_file(fileName: str):
    FileURequestValidation(**{"fileName": fileName})
    user_id = genai_core.auth.get_user_id(router)
    result = genai_core.presign.generate_user_presigned_get(
        user_id, fileName, expiration=600
    )

    logger.info("Generated pre-signed for " + fileName)
    return result


@router.resolver(field_name="listSessions")
@tracer.capture_method
def get_sessions():
    user_id = genai_core.auth.get_user_id(router)
    if user_id is None:
        raise genai_core.types.CommonError("User not found")

    sessions = genai_core.sessions.list_sessions_by_user_id(user_id)

    return [
        {
            "id": session.get("SessionId"),
            "title": session.get("History", [{}])[0]
            .get("data", {})
            .get("content", "<no title>"),
            "startTime": f'{session.get("StartTime")}Z',
        }
        for session in sessions
    ]


@router.resolver(field_name="getSession")
@tracer.capture_method
def get_session(id: str):
    WorkspaceIdValidation(**{"workspaceId": id})
    user_id = genai_core.auth.get_user_id(router)
    if user_id is None:
        raise genai_core.types.CommonError("User not found")

    session = genai_core.sessions.get_session(id, user_id)
    if not session:
        return None

    return {
        "id": session.get("SessionId"),
        "title": session.get("History", [{}])[0]
        .get("data", {})
        .get("content", "<no title>"),
        "startTime": f'{session.get("StartTime")}Z',
        "history": [
            {
                "type": item.get("type"),
                "content": item.get("data", {}).get("content"),
                "metadata": json.dumps(
                    item.get("data", {}).get("additional_kwargs"),
                    cls=genai_core.utils.json.CustomEncoder,
                ),
            }
            for item in session.get("History")
        ],
    }


@router.resolver(field_name="deleteUserSessions")
@tracer.capture_method
def delete_user_sessions():
    user_id = genai_core.auth.get_user_id(router)
    if user_id is None:
        raise genai_core.types.CommonError("User not found")

    result = genai_core.sessions.delete_user_sessions(user_id)

    return result


@router.resolver(field_name="deleteSession")
@tracer.capture_method
def delete_session(id: str):
    WorkspaceIdValidation(**{"workspaceId": id})
    user_id = genai_core.auth.get_user_id(router)
    if user_id is None:
        raise genai_core.types.CommonError("User not found")

    result = genai_core.sessions.delete_session(id, user_id)

    return result
