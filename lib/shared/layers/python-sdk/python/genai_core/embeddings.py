import os
import json
import numpy as np
import genai_core.types
import genai_core.clients
import genai_core.parameters
from typing import List, Optional

SAGEMAKER_RAG_MODELS_ENDPOINT = os.environ.get("SAGEMAKER_RAG_MODELS_ENDPOINT")


def generate_embeddings(
    model: genai_core.types.EmbeddingsModel, input: List[str], batch_size: int = 500
) -> List[List[float]]:
    input = list(map(lambda x: x[:10000], input))

    ret_value = []
    batch_split = [input[i: i + batch_size]
                   for i in range(0, len(input), batch_size)]

    for batch in batch_split:
        if model.provider == "openai":
            ret_value.extend(_generate_embeddings_openai(model, batch))
        elif model.provider == "bedrock":
            ret_value.extend(_generate_embeddings_bedrock(model, batch))
        elif model.provider == "sagemaker":
            ret_value.extend(_generate_embeddings_sagemaker(model, batch))
        else:
            raise genai_core.types.CommonError(f"Unknown provider")

    return ret_value


def get_embeddings_model(
    provider: str, name: str
) -> Optional[genai_core.types.EmbeddingsModel]:
    config = genai_core.parameters.get_config()
    models = config["rag"]["embeddingsModels"]

    for model in models:
        if model["provider"] == provider and model["name"] == name:
            return genai_core.types.EmbeddingsModel(**model)

    return None


def _generate_embeddings_openai(
    model: genai_core.types.EmbeddingsModel, input: List[str]
):
    openai = genai_core.clients.get_openai_client()

    if not openai:
        raise genai_core.types.CommonError(
            "OpenAI API is not available. Please set OPENAI_API_KEY."
        )

    data = openai.Embedding.create(input=input, model=model.name)["data"]
    ret_value = list(map(lambda x: x["embedding"], data))

    return ret_value


def _generate_embeddings_bedrock(
    model: genai_core.types.EmbeddingsModel, input: List[str]
):
    bedrock = genai_core.clients.get_bedrock_client()

    if not bedrock:
        raise genai_core.types.CommonError("Bedrock is not enabled.")

    ret_value = []
    for value in input:
        body = json.dumps({"inputText": value})
        response = bedrock.invoke_model(
            body=body,
            modelId=model.name,
            accept="application/json",
            contentType="application/json",
        )
        response_body = json.loads(response.get("body").read())
        embedding = response_body.get("embedding")

        ret_value.append(embedding)

    ret_value = np.array(ret_value)
    ret_value = ret_value / np.linalg.norm(ret_value, axis=1, keepdims=True)
    ret_value = ret_value.tolist()

    return ret_value


def _generate_embeddings_sagemaker(
    model: genai_core.types.EmbeddingsModel, input: List[str]
):
    client = genai_core.clients.get_sagemaker_client()

    response = client.invoke_endpoint(
        EndpointName=SAGEMAKER_RAG_MODELS_ENDPOINT,
        ContentType="application/json",
        Body=json.dumps(
            {"type": "embeddings", "model": model.name, "input": input}),
    )

    ret_value = json.loads(response["Body"].read().decode())

    return ret_value
