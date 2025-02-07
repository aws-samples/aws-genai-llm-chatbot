import re
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

    bedrock_cris_models = list_bedrock_cris_models()
    if bedrock_cris_models:
        models.extend(bedrock_cris_models)

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
                    "bedrockGuardrails": True,
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
            "bedrockGuardrails": True,
        }
        for model in models.split(",")
    ]


# Based on the table (Need to support both document and sytem prompt)
# https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference-supported-models-features.html
def does_model_support_documents(model_name):
    return (
        not re.match(r"^ai21.jamba*", model_name)
        and not re.match(r"^ai21.j2*", model_name)
        and not re.match(r"^amazon.titan-t*", model_name)
        and not re.match(r"^cohere.command-light*", model_name)
        and not re.match(r"^cohere.command-text*", model_name)
        and not re.match(r"^mistral.mistral-7b-instruct-*", model_name)
        and not re.match(r"^mistral.mistral-small*", model_name)
        and not re.match(r"^amazon.nova-reel*", model_name)
        and not re.match(r"^amazon.nova-canvas*", model_name)
        and not re.match(r"^amazon.nova-micro*", model_name)
    )


def create_bedrock_model_profile(bedrock_model: dict, model_name: str) -> dict:
    model = {
        "provider": Provider.BEDROCK.value,
        "name": model_name,
        "streaming": bedrock_model.get("responseStreamingSupported", False),
        "inputModalities": bedrock_model["inputModalities"],
        "outputModalities": bedrock_model["outputModalities"],
        "interface": ModelInterface.LANGCHAIN.value,
        "ragSupported": True,
        "bedrockGuardrails": True,
    }

    if does_model_support_documents(model["name"]):
        model["inputModalities"].append("DOCUMENT")
    return model


def list_cross_region_inference_profiles():
    bedrock = genai_core.clients.get_bedrock_client(service_name="bedrock")
    response = bedrock.list_inference_profiles()

    return {
        inference_profile["models"][0]["modelArn"].split("/")[1]: inference_profile[
            "inferenceProfileId"
        ]
        for inference_profile in response.get("inferenceProfileSummaries", [])
        if (
            inference_profile.get("status") == "ACTIVE"
            and inference_profile.get("type") == "SYSTEM_DEFINED"
        )
    }


def list_bedrock_cris_models():
    try:
        cross_region_profiles = list_cross_region_inference_profiles()
        bedrock_client = genai_core.clients.get_bedrock_client(service_name="bedrock")
        all_models = bedrock_client.list_foundation_models()["modelSummaries"]

        return [
            create_bedrock_model_profile(model, cross_region_profiles[model["modelId"]])
            for model in all_models
            if genai_core.types.InferenceType.INFERENCE_PROFILE.value
            in model["inferenceTypesSupported"]
        ]
    except Exception as e:
        logger.error(f"Error listing cross region inference profiles models: {e}")
        return None


def list_bedrock_models():
    try:
        bedrock = genai_core.clients.get_bedrock_client(service_name="bedrock")
        if not bedrock:
            return None

        response = bedrock.list_foundation_models(
            byInferenceType=genai_core.types.InferenceType.ON_DEMAND.value,
        )
        bedrock_models = [
            m
            for m in response.get("modelSummaries", [])
            if m.get("modelLifecycle", {}).get("status")
            == genai_core.types.ModelStatus.ACTIVE.value
        ]

        models = []
        for bedrock_model in bedrock_models:
            # Exclude embeddings models
            if (
                "inputModalities" in bedrock_model
                and "outputModalities" in bedrock_model
                and (
                    Modality.EMBEDDING.value
                    in bedrock_model.get("outputModalities", [])
                )
            ):
                continue
            models.append(
                create_bedrock_model_profile(bedrock_model, bedrock_model["modelId"])
            )

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
            # Only the langchain interface supports at this time using the bedrock ApplyGuardrail api # noqa
            "bedrockGuardrails": model["interface"] != "multimodal",
        }
        for model in models
    ]


def _get_model_modalities(model_id: str):
    try:
        model_name = model_id.split("::")[1]
        models = genai_core.models.list_models()
        model = next((m for m in models if m.get("name") == model_name), None)

        if model is None:
            raise genai_core.types.CommonError(f"Model {model_id} not found")

        return model.get("outputModalities", [])
    except IndexError:
        raise genai_core.types.CommonError(f"Invalid model ID format: {model_id}")
