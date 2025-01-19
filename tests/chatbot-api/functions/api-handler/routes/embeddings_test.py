from pydantic import ValidationError
import pytest
from genai_core.types import CommonError, EmbeddingsModel
from routes.embeddings import models
from routes.embeddings import embeddings

input = {"model": "model", "provider": "provider", "passages": ["passage"]}


def test_models(mocker):
    mocker.patch("genai_core.embeddings.get_embeddings_models", return_value=[])
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])
    assert models() == []


def test_embeddings(mocker):
    model = EmbeddingsModel(**{"provider": "provider", "name": "name", "dimensions": 1})
    mocker.patch("genai_core.embeddings.get_embeddings_model", return_value=model)
    mocker.patch("genai_core.embeddings.generate_embeddings", return_value=["1"])
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])

    response = embeddings(input)
    assert len(response) == 1
    assert response[0].get("vector") == "1"
    assert response[0].get("passage") == "passage"


def test_embeddings_unauthorized(mocker):
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user"])
    response = embeddings(input)
    assert response.get("error") == "Unauthorized"


def test_embedings_not_found(mocker):
    mocker.patch("genai_core.embeddings.get_embeddings_model", return_value=None)
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])
    with pytest.raises(CommonError):
        embeddings(input)


def test_embedings_invalid_input(mocker):
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])
    with pytest.raises(ValidationError, match="3 validation errors"):
        embeddings({})
    with pytest.raises(ValidationError, match="3 validation errors"):
        invalid = input.copy()
        invalid["model"] = "<"
        invalid["provider"] = "<"
        invalid["task"] = "invalid"
        embeddings(invalid)
    with pytest.raises(ValidationError, match="2 validation error"):
        invalid = input.copy()
        invalid["model"] = ""
        invalid["provider"] = ""
        invalid["passages"] = []
        invalid["task"] = "store"
        embeddings(invalid)
    with pytest.raises(CommonError, match="Passages is empty"):
        invalid = input.copy()
        invalid["passages"] = []
        embeddings(invalid)
    with pytest.raises(ValidationError, match="1 validation error"):
        invalid = input.copy()
        invalid["passages"] = [""]
        embeddings(invalid)
