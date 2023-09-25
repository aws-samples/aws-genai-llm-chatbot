import genai_core.sessions
import genai_core.types
import genai_core.auth
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler.api_gateway import Router

tracer = Tracer()
router = Router()
logger = Logger()


@router.get("/sessions")
@tracer.capture_method
def get_sessions():
    user_id = genai_core.auth.get_user_id(router)
    if user_id is None:
        raise genai_core.types.CommonError("User not found")

    sessions = genai_core.sessions.list_sessions_by_user_id(user_id)

    return {
        "ok": True,
        "data": [
            {
                "id": session.get("SessionId"),
                "title": session.get("History")[0].get("data", {}).get("content")
                if session.get("History")
                else "<no_title>",
                "startTime": session.get("StartTime"),
            }
            for session in sessions
        ],
    }


@router.get("/sessions/<session_id>")
@tracer.capture_method
def get_session(session_id: str):
    user_id = genai_core.auth.get_user_id(router)
    if user_id is None:
        raise genai_core.types.CommonError("User not found")

    session = genai_core.sessions.get_session(session_id, user_id)
    if not session:
        return {"ok": True, "data": None}

    return {
        "ok": True,
        "data": {
            "id": session.get("SessionId"),
            "title": session.get("History")[0].get("data", {}).get("content")
            if session.get("History")
            else "<no_title>",
            "startTime": session.get("StartTime"),
            "history": [
                {
                    "type": item.get("type"),
                    "content": item.get("data", {}).get("content"),
                    "metadata": item.get("data", {}).get("additional_kwargs"),
                }
                for item in session.get("History")
            ],
        },
    }


@router.delete("/sessions")
@tracer.capture_method
def delete_user_sessions():
    user_id = genai_core.auth.get_user_id(router)
    if user_id is None:
        raise genai_core.types.CommonError("User not found")

    result = genai_core.sessions.delete_user_sessions(user_id)

    return {"ok": True, "data": result}


@router.delete("/sessions/<session_id>")
@tracer.capture_method
def delete_session(session_id: str):
    user_id = genai_core.auth.get_user_id(router)
    if user_id is None:
        raise genai_core.types.CommonError("User not found")

    result = genai_core.sessions.delete_session(session_id, user_id)

    return {"ok": True, "data": result}
