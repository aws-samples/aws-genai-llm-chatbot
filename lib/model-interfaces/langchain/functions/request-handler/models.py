import os

import boto3


def list_models():
    models = []
    bedrock_models = list_bedrock_models()
    if bedrock_models:
        models.append(bedrock_models)

    sagemaker_models = list_sagemaker_models()
    if sagemaker_models:
        models.append(sagemaker_models)

    if os.environ.get("OPENAI_API_KEY"):
        models.append(list_openai_models())

    return models


def list_openai_models():
    import openai

    openai.api_key = os.environ["OPENAI_API_KEY"]
    models = openai.Model.list()
    return {
        "label": "OpenAI",
        "models": [
            {
                "provider": "openai",
                "modelId": model["id"],
                "streaming": True,
                "type": "text-generation",
            }
            for model in models.data
            if model["id"].startswith("gpt")
        ],
    }


def list_bedrock_models():
    try:
        region_name = os.environ["BEDROCK_REGION"]
        endpoint_url = os.environ["BEDROCK_ENDPOINT_URL"]
        bedrock = boto3.client(
            "bedrock",
            region_name=region_name,
            endpoint_url=endpoint_url,
        )

        response = bedrock.list_foundation_models()
        bedrock_models = response.get("modelSummaries", [])

        models = [
            {
                "provider": "bedrock",
                "modelId": model["modelId"],
                "streaming": False,
                "type": "text-generation",
            }
            for model in bedrock_models
            # Exclude text-to-image models and Titan-Embeddings models
            if not (
                model["modelId"].startswith("stability")
                or "titan-e" in model["modelId"]
            )
        ]

        return {
            "label": "Amazon Bedrock",
            "models": models,
        }
    except Exception as e:
        print(f"Error listing Bedrock models, likely still in preview: {e}")
        return {}


def list_sagemaker_models():
    sagemaker_endpoints = [
        os.environ[key]
        for key in os.environ.keys()
        if key.startswith("SAGEMAKER_ENDPOINT_")
    ]

    if not sagemaker_endpoints:
        return {}

    return {
        "label": "Amazon SageMaker",
        "models": [
            {
                "provider": "SageMaker",
                "modelId": endpoint,
                "streaming": False,
            }
            for endpoint in sagemaker_endpoints
        ],
    }
