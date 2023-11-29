import os
from aws_lambda_powertools.utilities import parameters

X_ORIGIN_VERIFY_SECRET_ARN = os.environ.get("X_ORIGIN_VERIFY_SECRET_ARN")
API_KEYS_SECRETS_ARN = os.environ.get("API_KEYS_SECRETS_ARN")
CONFIG_PARAMETER_NAME = os.environ.get("CONFIG_PARAMETER_NAME")
MODELS_PARAMETER_NAME = os.environ.get("MODELS_PARAMETER_NAME")


def get_external_api_key(name: str):
    api_keys = parameters.get_secret(API_KEYS_SECRETS_ARN, transform="json", max_age=60)

    key_value = api_keys.get(name)
    return key_value


def get_origin_verify_header_value():
    origin_verify_header_value = parameters.get_secret(
        X_ORIGIN_VERIFY_SECRET_ARN, transform="json", max_age=60
    )["headerValue"]

    return origin_verify_header_value


def get_config():
    config = parameters.get_parameter(
        CONFIG_PARAMETER_NAME, transform="json", max_age=60 * 5
    )

    return config


def get_root_parameter_path():
    config = get_config()
    return config.get("prefix", "") + "GenAIChatBotStack"

def get_product_config():
    return parameters.get_parameter(
        f"/{get_root_parameter_path()}/products-config"
    )

def get_sagemaker_models():
    return parameters.get_parameters(
        f"/{get_root_parameter_path()}/chatbot/models/", transform="json", max_age=30
    )


def get_provisionable_sagemaker_model_details():
    path = f"/{get_root_parameter_path()}/products/"
    return parameters.get_parameters(path, transform="json", max_age=30)
