from aws_lambda_powertools import Logger
import genai_core.types
import genai_core.clients
import genai_core.parameters

from genai_core.types import Modality, Provider, ModelInterface

logger = Logger()


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

    azure_openai_models = list_azure_openai_models()
    if azure_openai_models:
        models.extend(azure_openai_models)

    return models


def list_openai_models():
    openai = genai_core.clients.get_openai_client()
    if not openai:
        return None

    models = []
    for model in openai.models.list():
        if model.id.startswith("gpt"):
            models.append(
                {
                    "provider": Provider.OPENAI.value,
                    "name": model.id,
                    "streaming": True,
                    "inputModalities": [Modality.TEXT.value],
                    "outputModalities": [Modality.TEXT.value],
                    "interface": ModelInterface.LANGCHAIN.value,
                    "ragSupported": True,
                }
            )

    return models


def list_azure_openai_models():
    # azure openai model are listed, comma separated in
    # AZURE_OPENAI_MODELS variable in external API secret
    models = genai_core.parameters.get_external_api_key("AZURE_OPENAI_MODELS") or ""
    if not models:
        return None
    return [
        {
            "provider": Provider.AZURE_OPENAI.value,
            "name": model,
            "streaming": True,
            "inputModalities": [Modality.TEXT.value],
            "outputModalities": [Modality.TEXT.value],
            "interface": ModelInterface.LANGCHAIN.value,
            "ragSupported": True,
        }
        for model in models.split(",")
    ]


def list_bedrock_models():
    try:
        bedrock = genai_core.clients.get_bedrock_client(service_name="bedrock")
        if not bedrock:
            return None

        response = bedrock.list_foundation_models(
            byInferenceType=genai_core.types.InferenceType.ON_DEMAND.value,
            byOutputModality=genai_core.types.Modality.TEXT.value,
        )
        bedrock_models = [
            m
            for m in response.get("modelSummaries", [])
            if m.get("modelLifecycle", {}).get("status")
            == genai_core.types.ModelStatus.ACTIVE.value
        ]

        models = [
            {
                "provider": Provider.BEDROCK.value,
                "name": model["modelId"],
                "streaming": model.get("responseStreamingSupported", False),
                "inputModalities": model["inputModalities"],
                "outputModalities": model["outputModalities"],
                "interface": ModelInterface.LANGCHAIN.value,
                "ragSupported": True,
            }
            for model in bedrock_models
            # Exclude embeddings and stable diffusion models
            if "inputModalities" in model
            and "outputModalities" in model
            and Modality.EMBEDDING.value not in model.get("outputModalities", [])
            and Modality.IMAGE.value not in model.get("outputModalities", [])
        ]

        return models
    except Exception as e:
        logger.error(f"Error listing Bedrock models: {e}")
        return None


def list_bedrock_finetuned_models():
    try:
        bedrock = genai_core.clients.get_bedrock_client(service_name="bedrock")
        if not bedrock:
            return None

        response = bedrock.list_custom_models()
        bedrock_custom_models = response.get("modelSummaries", [])

        models = [
            {
                "provider": Provider.BEDROCK.value,
                "name": f"{model['modelName']} (base model: {model['baseModelName']})",
                "streaming": model.get("responseStreamingSupported", False),
                "inputModalities": model["inputModalities"],
                "outputModalities": model["outputModalities"],
                "interface": ModelInterface.LANGCHAIN.value,
                "ragSupported": True,
            }
            for model in bedrock_custom_models
            # Exclude embeddings and stable diffusion models
            if "inputModalities" in model
            and "outputModalities" in model
            and Modality.EMBEDDING.value not in model.get("outputModalities", [])
            and Modality.IMAGE.value not in model.get("outputModalities", [])
        ]

        return models
    except Exception as e:
        logger.error(f"Error listing fine-tuned Bedrock models: {e}")
        return None


def list_sagemaker_models():
    models = genai_core.parameters.get_sagemaker_models()

    return [
        {
            "provider": Provider.SAGEMAKER.value,
            "name": model["name"],
            "streaming": model.get("responseStreamingSupported", False),
            "inputModalities": model["inputModalities"],
            "outputModalities": model["outputModalities"],
            "interface": model["interface"],
            "ragSupported": model["ragSupported"],
        }
        for model in models
    ]
