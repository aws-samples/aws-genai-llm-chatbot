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
    assert models() == []


def test_cross_encoders(mocker):
    model = CrossEncoderModel(**{"provider": "provider", "name": "name"})
    mocker.patch("genai_core.cross_encoder.get_cross_encoder_model", return_value=model)
    mocker.patch("genai_core.cross_encoder.rank_passages", return_value=["1"])

    response = cross_encoders(input)
    assert len(response) == 1
    assert response[0].get("score") == "1"
    assert response[0].get("passage") == "passage"


def test_cross_encoders_not_found(mocker):
    mocker.patch("genai_core.cross_encoder.get_cross_encoder_model", return_value=None)
    with pytest.raises(CommonError):
        cross_encoders(input)
