from pydantic import ValidationError
import pytest
from routes.cross_encoders import models
from routes.cross_encoders import cross_encoders
from genai_core.types import CrossEncoderModel
from genai_core.types import CommonError

input = {
    "model": "model",
    "provider": "provider",
    "reference": "reference",
    "passages": ["passage"],
}


def test_models(mocker):
    mocker.patch("genai_core.cross_encoder.get_cross_encoder_models", return_value=[])
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])
    assert models() == []


def test_cross_encoders(mocker):
    model = CrossEncoderModel(**{"provider": "provider", "name": "name"})
    mocker.patch("genai_core.cross_encoder.get_cross_encoder_model", return_value=model)
    mocker.patch("genai_core.cross_encoder.rank_passages", return_value=["1"])
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])

    response = cross_encoders(input)
    assert len(response) == 1
    assert response[0].get("score") == "1"
    assert response[0].get("passage") == "passage"


def test_cross_encoders_unauthorized(mocker):
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user"])
    response = cross_encoders(input)
    assert response.get("error") == "Unauthorized"


def test_cross_encoders_not_found(mocker):
    mocker.patch("genai_core.cross_encoder.get_cross_encoder_model", return_value=None)
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])
    with pytest.raises(CommonError):
        cross_encoders(input)


def test_cross_encoders_invalid_input(mocker):
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])
    with pytest.raises(ValidationError, match="4 validation errors"):
        cross_encoders({})
    with pytest.raises(ValidationError, match="3 validation errors"):
        invalid = input.copy()
        invalid["model"] = "<"
        invalid["provider"] = ""
        invalid["reference"] = ""
        cross_encoders(invalid)
    with pytest.raises(CommonError, match="Passages is empty"):
        invalid = input.copy()
        invalid["passages"] = []
        cross_encoders(invalid)
    with pytest.raises(ValidationError, match="1 validation error"):
        invalid = input.copy()
        invalid["passages"] = [""]
        cross_encoders(invalid)
