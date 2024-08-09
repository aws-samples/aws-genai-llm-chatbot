import os
import json
import genai_core.types
import genai_core.clients
import genai_core.parameters
from typing import List, Optional


SAGEMAKER_RAG_MODELS_ENDPOINT = os.environ.get("SAGEMAKER_RAG_MODELS_ENDPOINT")


def rank_passages(
    model: genai_core.types.CrossEncoderModel, input: str, passages: List[str]
):
    input = input[:10000]
    passages = passages[:1000]
    passages = list(map(lambda x: x[:10000], passages))

    if model.provider == "sagemaker":
        return _rank_passages_sagemaker(model, input, passages)

    raise genai_core.typesCommonError("Unknown provider")


def get_cross_encoder_models():
    config = genai_core.parameters.get_config()
    models = config["rag"]["crossEncoderModels"]

    if not SAGEMAKER_RAG_MODELS_ENDPOINT:
        models = list(filter(lambda x: x["provider"] != "sagemaker", models))

    return models


def get_cross_encoder_model(
    provider: str, name: str
) -> Optional[genai_core.types.CrossEncoderModel]:
    config = genai_core.parameters.get_config()
    models = config["rag"]["crossEncoderModels"]

    for model in models:
        if model["provider"] == provider and model["name"] == name:
            return genai_core.types.CrossEncoderModel(**model)

    return None


def _rank_passages_sagemaker(
    model: genai_core.types.CrossEncoderModel, input: str, passages: List[str]
):
    client = genai_core.clients.get_sagemaker_client()

    response = client.invoke_endpoint(
        EndpointName=SAGEMAKER_RAG_MODELS_ENDPOINT,
        ContentType="application/json",
        Body=json.dumps(
            {
                "type": "cross-encoder",
                "model": model.name,
                "input": input,
                "passages": passages,
            }
        ),
    )

    ret_value = json.loads(response["Body"].read().decode())

    return ret_value
