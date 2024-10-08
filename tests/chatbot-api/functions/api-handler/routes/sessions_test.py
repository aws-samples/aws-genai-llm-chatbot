from pydantic import ValidationError
import pytest
from genai_core.types import CommonError
from routes.sessions import get_file
from routes.sessions import get_sessions
from routes.sessions import get_session
from routes.sessions import delete_user_sessions
from routes.sessions import delete_session

session = {
    "SessionId": "SessionId",
    "StartTime": "123",
    "History": [
        {
            "type": "type",
            "data": {"content": "content", "additional_kwargs": "additional_kwargs"},
        }
    ],
}


def test_get_file_url(mocker):
    mocker.patch("genai_core.auth.get_user_id", return_value="userId")
    mocker.patch("genai_core.presign.generate_user_presigned_get", return_value="url")
    assert get_file("file") == "url"


def test_get_sessions(mocker):
    mocker.patch("genai_core.auth.get_user_id", return_value="userId")
    mocker.patch("genai_core.sessions.list_sessions_by_user_id", return_value=[session])
    expected = [
        {
            "id": session.get("SessionId"),
            "title": "content",
            "startTime": session.get("StartTime") + "Z",
        }
    ]
    assert get_sessions() == expected


def test_get_sessions_user_not_found(mocker):
    mocker.patch("genai_core.auth.get_user_id", return_value=None)
    with pytest.raises(CommonError):
        get_sessions()


def test_get_session(mocker):
    mocker.patch("genai_core.auth.get_user_id", return_value="userId")
    mocker.patch("genai_core.sessions.get_session", return_value=session)
    expected = {
        "id": session.get("SessionId"),
        "title": "content",
        "startTime": session.get("StartTime") + "Z",
        "history": [
            {"type": "type", "content": "content", "metadata": '"additional_kwargs"'}
        ],
    }
    assert get_session("id") == expected


def test_get_session_invalid_input():
    with pytest.raises(ValidationError, match="1 validation error"):
        get_session("")
    with pytest.raises(ValidationError, match="1 validation error"):
        get_session(None)


def test_get_session_user_not_found(mocker):
    mocker.patch("genai_core.auth.get_user_id", return_value=None)
    with pytest.raises(CommonError):
        get_session("id")


def test_get_session_not_found(mocker):
    mocker.patch("genai_core.auth.get_user_id", return_value="userId")
    mocker.patch("genai_core.sessions.get_session", return_value=None)
    assert get_session("id") == None


def test_delete_user_sessions(mocker):
    service_response = {"id": "id", "deleted": True}
    mocker.patch("genai_core.auth.get_user_id", return_value="userId")
    mocker.patch(
        "genai_core.sessions.delete_user_sessions", return_value=[service_response]
    )
    assert delete_user_sessions() == [service_response]


def test_delete_user_sessions_user_not_found(mocker):
    mocker.patch("genai_core.auth.get_user_id", return_value=None)
    with pytest.raises(CommonError):
        delete_user_sessions()


def test_delete_session(mocker):
    service_response = {"id": "id", "deleted": True}
    mocker.patch("genai_core.auth.get_user_id", return_value="userId")
    mocker.patch("genai_core.sessions.delete_session", return_value=service_response)
    assert delete_session("id") == service_response


def test_delete_session_invalid_input():
    with pytest.raises(ValidationError, match="1 validation error"):
        delete_session("")
    with pytest.raises(ValidationError, match="1 validation error"):
        delete_session(None)


def test_delete_session_user_not_found(mocker):
    mocker.patch("genai_core.auth.get_user_id", return_value=None)
    with pytest.raises(CommonError):
        delete_session("id")
