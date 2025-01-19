from pydantic import ValidationError
import pytest
from genai_core.types import CommonError
from routes.user_feedback import user_feedback

input = {
    "sessionId": "sessionId",
    "key": 1,
    "feedback": "feedback",
    "prompt": "prompt",
    "completion": "completion",
    "model": "model",
}


def test_user_feedback(mocker):
    mocker.patch("genai_core.auth.get_user_id", return_value="userId")
    mock = mocker.patch(
        "genai_core.user_feedback.add_user_feedback",
        return_value={"feedback_id": "feedback_id"},
    )
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])

    assert user_feedback(input) == {"feedback_id": "feedback_id"}

    mock.assert_called_once_with(
        input.get("sessionId"),
        input.get("key"),
        input.get("feedback"),
        input.get("prompt"),
        input.get("completion"),
        input.get("model"),
        "userId",
    )


def test_user_feedback_user_not_found(mocker):
    mocker.patch("genai_core.auth.get_user_id", return_value=None)
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])
    with pytest.raises(CommonError):
        user_feedback(input)


def test_user_feedback_invalid_input(mocker):
    with pytest.raises(ValidationError, match="5 validation error"):
        user_feedback({})
    with pytest.raises(ValidationError, match="5 validation error"):
        user_feedback(
            {
                "sessionId": "",
                "key": "",
                "feedback": "",
                "prompt": "",
                "completion": "",
                "model": "",
            }
        )
    with pytest.raises(ValidationError, match="4 validation error"):
        user_feedback(
            {
                "sessionId": "<",
                "key": "<",
                "feedback": "<",
                "prompt": "<",
                "completion": "<",
                "model": "<",
            }
        )
