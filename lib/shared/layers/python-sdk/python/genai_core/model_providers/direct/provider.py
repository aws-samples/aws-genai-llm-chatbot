import os
import re
from abc import ABC
from typing import Any, Optional

from aws_lambda_powertools import Logger

import genai_core.clients
import genai_core.parameters
from genai_core.types import EmbeddingsModel, Modality, ModelInterface, Provider

from ..types import ModelProvider

SAGEMAKER_RAG_MODELS_ENDPOINT = os.environ.get("SAGEMAKER_RAG_MODELS_ENDPOINT")
logger = Logger()


class DirectModelProvider(ModelProvider, ABC):
    """Provider that connects directly to model services"""

    def list_models(self) -> list[dict[str, Any]]:
        """
        List available models by querying each provider directly

        Returns:
            List of model information dictionaries
        """
        models = []

        # Get Bedrock models
        bedrock_models = _list_bedrock_models()
        if bedrock_models:
            models.extend(bedrock_models)

        bedrock_cris_models = _list_bedrock_cris_models()
        if bedrock_cris_models:
            models.extend(bedrock_cris_models)

        fine_tuned_models = _list_bedrock_finetuned_models()
        if fine_tuned_models:
            models.extend(fine_tuned_models)
            
        # Get Bedrock agent models
        bedrock_agent_models = _list_bedrock_agent_models()
        if bedrock_agent_models:
            models.extend(bedrock_agent_models)

        # Get SageMaker models
        sagemaker_models = _list_sagemaker_models()
        if sagemaker_models:
            models.extend(sagemaker_models)

        # Get OpenAI models
        openai_models = _list_openai_models()
        if openai_models:
            models.extend(openai_models)

        # Get Azure OpenAI models
        azure_openai_models = _list_azure_openai_models()
        if azure_openai_models:
            models.extend(azure_openai_models)

        return models

    def get_embedding_models(self) -> list[dict[str, Any]]:
        config = genai_core.parameters.get_config()
        models = config["rag"]["embeddingsModels"]

        if not SAGEMAKER_RAG_MODELS_ENDPOINT:
            models = [x for x in models if x["provider"] != "sagemaker"]

        return models

    def get_embeddings_model(
        self, provider: Provider, name: str
    ) -> Optional[EmbeddingsModel]:
        config = genai_core.parameters.get_config()
        models = config["rag"]["embeddingsModels"]

        for model in models:
            if model["provider"] == provider and model["name"] == name:
                return EmbeddingsModel(**model)

        return None

    def get_model_modalities(self, model_id: str) -> list[str]:
        try:
            model_name = model_id.split("::")[1]
            models = self.list_models()
            model = next((m for m in models if m.get("name") == model_name), None)

            if model is None:
                raise genai_core.types.CommonError(f"Model {model_id} not found")

            return model.get("outputModalities", [])
        except IndexError:
            raise genai_core.types.CommonError(
                f"Invalid model ID format: {model_id}"
            ) from None


def _list_openai_models():
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


def _list_azure_openai_models():
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
def _does_model_support_documents(model_name):
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


def _create_bedrock_model_profile(bedrock_model: dict, model_name: str) -> dict:
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

    if _does_model_support_documents(model["name"]):
        model["inputModalities"].append("DOCUMENT")
    return model


def _list_cross_region_inference_profiles():
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


def _list_bedrock_cris_models():
    try:
        cross_region_profiles = _list_cross_region_inference_profiles()
        bedrock_client = genai_core.clients.get_bedrock_client(service_name="bedrock")
        all_models = bedrock_client.list_foundation_models()["modelSummaries"]

        return [
            _create_bedrock_model_profile(
                model, cross_region_profiles[model["modelId"]]
            )
            for model in all_models
            if genai_core.types.InferenceType.INFERENCE_PROFILE.value
            in model["inferenceTypesSupported"]
        ]
    except Exception as e:
        logger.error(f"Error listing cross region inference profiles models: {e}")
        return None


def _list_bedrock_models():
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
                _create_bedrock_model_profile(bedrock_model, bedrock_model["modelId"])
            )

        return models
    except Exception as e:
        logger.error(f"Error listing Bedrock models: {e}")
        return None


def _list_bedrock_finetuned_models():
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


def _list_bedrock_agent_models():
    """
    List Bedrock agent models if enabled in the config
    
    Returns:
        list[dict[str, Any]]: List of Bedrock agent model information dictionaries
    """
    try:
        # Check if Bedrock agent is enabled via environment variables
        agent_enabled = os.environ.get("BEDROCK_AGENT_ENABLED") == "true"
        agent_id = os.environ.get("BEDROCK_AGENT_ID")
        
        if not agent_enabled:
            return None
            
        # If a specific agent ID is provided, just add that one
        if agent_id:
            return [
                {
                    "provider": Provider.BEDROCK.value,
                    "name": "bedrock_agent",
                    "streaming": False,  # Agents don't support streaming
                    "inputModalities": [Modality.TEXT.value, Modality.IMAGE.value, "DOCUMENT"],
                    "outputModalities": [Modality.TEXT.value],
                    "interface": ModelInterface.LANGCHAIN.value,
                    "ragSupported": True,
                    "bedrockGuardrails": True,
                    "displayName": f"Bedrock Agent: {agent_id}"
                }
            ]
        
        # If no specific agent ID is provided, list all available agents
        from genai_core.bedrock_agent import list_agents
        
        agents = list_agents()
        if not agents:
            logger.warning("No Bedrock agents found in the account")
            return None
            
        models = []
        for agent in agents:
            agent_id = agent.get("agentId")
            agent_name = agent.get("agentName")
            
            # Create a model entry for each agent
            models.append({
                "provider": Provider.BEDROCK.value,
                "name": f"Agent_{agent_name.replace(' ', '_')}_{agent_id}",
                "streaming": False,  # Agents don't support streaming
                "inputModalities": [Modality.TEXT.value, Modality.IMAGE.value, "DOCUMENT"],
                "outputModalities": [Modality.TEXT.value],
                "interface": ModelInterface.LANGCHAIN.value,
                "ragSupported": True,
                "bedrockGuardrails": True,
                "displayName": f"Bedrock Agent: {agent_name}"
            })
        
        return models
    except Exception as e:
        logger.error(f"Error listing Bedrock agent models: {e}")
        return None


def _list_sagemaker_models():
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
            # Only langchain interface supports bedrock ApplyGuardrail api
            "bedrockGuardrails": model["interface"] != "multimodal",
        }
        for model in models
    ]
