import genai_core.types
import genai_core.clients
import genai_core.parameters


def list_models():
    models = []

    bedrock_models = list_bedrock_models()
    if bedrock_models:
        models.extend(bedrock_models)

    fine_tuned_models = list_bedrock_finetuned_models()
    if fine_tuned_models:
        models.extend(fine_tuned_models)

    sagemaker_models = list_sagemaker_models()
    if sagemaker_models:
        models.extend(sagemaker_models)

    openai_models = list_openai_models()
    if openai_models:
        models.extend(openai_models)

    return models


def list_openai_models():
    openai = genai_core.clients.get_openai_client()
    if not openai:
        return None

    models = openai.Model.list()

    return [
        {
            "provider": "openai",
            "name": model["id"],
            "streaming": True,
            "type": "text-generation",
        }
        for model in models.data
        if model["id"].startswith("gpt")
    ]


def list_bedrock_models():
    try:
        bedrock = genai_core.clients.get_bedrock_client(service_name="bedrock")
        response = bedrock.list_foundation_models()
        bedrock_models = response.get("modelSummaries", [])

        models = [
            {
                "provider": "bedrock",
                "name": model["modelId"],
                "streaming": model["modelId"].startswith("amazon")
                or model["modelId"].startswith("anthropic"),
                "type": "text-generation",
            }
            for model in bedrock_models
            # Exclude text-to-image models and Titan-Embeddings models
            if not (
                model["modelId"].startswith("stability")
                or "titan-e" in model["modelId"]
            )
        ]

        return models
    except Exception as e:
        print(f"Error listing Bedrock models, likely still in preview: {e}")
        return None


def list_bedrock_finetuned_models():
    try:
        bedrock = genai_core.clients.get_bedrock_client(service_name="bedrock")
        response = bedrock.list_custom_models()
        bedrock_custom_models = response.get("modelSummaries", [])

        models = [
            {
                "provider": "bedrock",
                "name": f"{model['modelName']} (base model: {model['baseModelName']})",
                "streaming": False,
                "type": "text-generation",
            }
            for model in bedrock_custom_models
        ]

        return models
    except Exception as e:
        print(f"Error listing Bedrock models, likely still in preview: {e}")
        return None


def list_sagemaker_models():
    models = genai_core.parameters.get_sagemaker_llms()

    return [
        {
            "provider": "sagemaker",
            "name": model["name"],
            "streaming": False,
        }
        for model in models
    ]
