import json
import genai_core.types
import genai_core.clients
import genai_core.parameters

from genai_core.types import Modality, Provider, ModelInterface



def list_models():
    models = []

    bedrock_models = list_bedrock_models()
    if bedrock_models:
        models.extend(bedrock_models)

    fine_tuned_models = list_bedrock_finetuned_models()
    if fine_tuned_models:
        models.extend(fine_tuned_models)

    """Get SageMaker Models that are deployed
    Then get Service Catalog Products of Deployable Models
    Compare deployed models to products to determine if
    a model is deployed or not AND if it's deployable or not
    (for example, if SageMaker models are added but not through SC)
    """
    sagemaker_models = list_sagemaker_models()

    provisionable_sagemaker_models = list_provisionable_sagemaker_models()
    if provisionable_sagemaker_models and sagemaker_models:
        models.extend(
            merge_deployed_and_provisionable_models(
                sagemaker_models, provisionable_sagemaker_models
            )
        )
    elif provisionable_sagemaker_models:
        models.extend(provisionable_sagemaker_models)
    elif sagemaker_models:
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
            "provider": Provider.OPENAI.value,
            "name": model["id"],
            "streaming": True,
            "inputModalities": [Modality.TEXT.value],
            "outputModalities": [Modality.TEXT.value],
            "interface": ModelInterface.LANGCHIAN.value,
            "ragSupported": True,
        }
        for model in models.data
        if model["id"].startswith("gpt")
    ]


def list_bedrock_models():
    try:
        bedrock = genai_core.clients.get_bedrock_client(service_name="bedrock")
        if not bedrock:
            return None

        response = bedrock.list_foundation_models()
        bedrock_models = response.get("modelSummaries", [])

        models = [
            {
                "provider": Provider.BEDROCK.value,
                "name": model["modelId"],
                "streaming": model.get("responseStreamingSupported", False),
                "inputModalities": model["inputModalities"],
                "outputModalities": model["outputModalities"],
                "interface": ModelInterface.LANGCHIAN.value,
                "ragSupported": True,
            }
            for model in bedrock_models
            # Exclude embeddings and stable diffusion models
            if model.get("inputModalities", None) != None
            and model.get("outputModalities", None) != None
            and Modality.EMBEDDING.value not in model.get("outputModalities", [])
            and Modality.IMAGE.value not in model.get("outputModalities", [])
        ]

        return models
    except Exception as e:
        print(f"Error listing Bedrock models: {e}")
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
                "interface": ModelInterface.LANGCHIAN.value,
                "ragSupported": True,
            }
            for model in bedrock_custom_models
            # Exclude embeddings and stable diffusion models
            if model.get("inputModalities", None) != None
            and model.get("outputModalities", None) != None
            and Modality.EMBEDDING.value not in model.get("outputModalities", [])
            and Modality.IMAGE.value not in model.get("outputModalities", [])
        ]

        return models
    except Exception as e:
        print(f"Error listing fine-tuned Bedrock models: {e}")
        return None

# TODO - shift away from parameter store and toward provisioned products 
def list_sagemaker_models():
    models = genai_core.parameters.get_sagemaker_models()
    if models is None:
        return None

    return [
        {
            "provider": Provider.SAGEMAKER.value,
            "name": modelConfig.get("name",modelConfig.get("modelId", None)),
            "modelId": modelConfig.get("modelId", None),
            "streaming": modelConfig.get("responseStreamingSupported", False),
            "inputModalities": modelConfig["inputModalities"],
            "outputModalities": modelConfig["outputModalities"],
            "interface": modelConfig["interface"],
            "ragSupported": modelConfig["ragSupported"],
            "productId": modelConfig.get("productId", None),
        }
        for modelKey, modelConfig in models.items()
    ]

# TODO - Check for provisioned products in service catalog
def list_provisionable_sagemaker_models():
    service_catalog = genai_core.clients.get_service_catalog_client()
    product_owner = genai_core.parameters.get_root_parameter_path()
    products_results = service_catalog.search_products(
        Filters={
            "Owner": [product_owner],
        }
    )

    products = products_results.get("ProductViewSummaries", [])

    product_details = genai_core.parameters.get_provisionable_sagemaker_model_details()
    if product_details is None:
        return []

    # Loop through products in service catalog and return the details from Parameter Store for the productId
    return [
        {
            "provider": Provider.SAGEMAKER.value,
            "name": product_details[product["ProductId"]]["modelId"],
            "modelId": product_details[product["ProductId"]]["modelId"],
            "streaming": product_details[product["ProductId"]].get("streaming", False),
            "inputModalities": product_details[product["ProductId"]].get(
                "inputModalities", []
            ),
            "outputModalities": product_details[product["ProductId"]].get(
                "outputModalities", []
            ),
            "interface": product_details[product["ProductId"]]["interface"],
            "ragSupported": product_details[product["ProductId"]]["ragSupported"],
            "productId": product_details[product["ProductId"]].get("productId", None),
            "deployed": False,  # Set to False by default, will be set to True if model is deployed in Service Catalog
        }
        for product in products
        if product["ProductId"] in product_details.keys()
    ]


def merge_deployed_and_provisionable_models(
    sagemaker_models, provisionable_sagemaker_models
):
    models = []
    # Compare the SC Products with the existing SageMaker Models to determine which ones are deployed
    for model in provisionable_sagemaker_models:
        if not any(m["productId"] == model["productId"] for m in sagemaker_models):
            model["deployed"] = False
        else:
            model["deployed"] = True
        models.append(model)
    # Check merged models for any deployed models that may not be in Service Catalog and add them back in.
    for model in sagemaker_models:
        if not any(m["productId"] == model["productId"] for m in models):
            models.append(model)
    return models



def deploy_model(product_id):
    product_config = genai_core.parameters.get_product_config()
    product_config['productId'] = product_id
    service_catalog = genai_core.clients.get_service_catalog_client()
    service_catalog.provision_product(
        ProductId=product_id,
        ProvisioningParameters=[{
            'Key': key,
            'Value': value
        } for key, value in product_config.items()]
    )
    