import pytest
from genai_core.types import CommonError, EmbeddingsModel
from routes.embeddings import models
from routes.embeddings import embeddings

input = {"model": "model", "provider": "provider", "passages": ["passage"]}


def test_models(mocker):
    mocker.patch("genai_core.embeddings.get_embeddings_models", return_value=[])
    assert models() == []


def test_embeddings(mocker):
    model = EmbeddingsModel(**{"provider": "provider", "name": "name", "dimensions": 1})
    mocker.patch("genai_core.embeddings.get_embeddings_model", return_value=model)
    mocker.patch("genai_core.embeddings.generate_embeddings", return_value=["1"])

    response = embeddings(input)
    assert len(response) == 1
    assert response[0].get("vector") == "1"
    assert response[0].get("passage") == "passage"


def test_embedings_not_found(mocker):
    mocker.patch("genai_core.embeddings.get_embeddings_model", return_value=None)
    with pytest.raises(CommonError):
        embeddings(input)
