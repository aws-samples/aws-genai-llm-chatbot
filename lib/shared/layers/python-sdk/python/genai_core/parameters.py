import os
import urllib
import json
from aws_lambda_powertools.utilities import parameters

X_ORIGIN_VERIFY_SECRET_ARN = os.environ.get("X_ORIGIN_VERIFY_SECRET_ARN")
API_KEYS_SECRETS_ARN = os.environ.get("API_KEYS_SECRETS_ARN")
CONFIG_PARAMETER_NAME = os.environ.get("CONFIG_PARAMETER_NAME")
MODELS_PARAMETER_NAME = os.environ.get("MODELS_PARAMETER_NAME")


def load_all_from_ssm():
    # Load all the Parameters and assigned them to an env variable
    # This is done using the Lambda extensions for parameter store
    load_from_ssm = os.environ.get("LOAD_FROM_SSM")
    load_from_ssm_prefix = os.environ.get("LOAD_FROM_SSM_PREFIX")
    token = os.environ.get("AWS_SESSION_TOKEN")

    if not token or not load_from_ssm or not load_from_ssm_prefix:
        raise Exception("Please make sure env variables are set.")

    for var in load_from_ssm.split(","):
        if var not in os.environ:
            os.environ[var] = get_ssm_parameter(load_from_ssm_prefix + var, token)


def get_ssm_parameter(ssm_parameter_path: str, token: str):
    # https://docs.aws.amazon.com/systems-manager/latest/userguide/ps-integration-lambda-extensions.html#ps-integration-lambda-extensions-how-it-works
    params = urllib.parse.urlencode({"name": ssm_parameter_path})
    url = "http://localhost:2773/systemsmanager/parameters/get/?%s" % params
    request = urllib.request.Request(url)
    request.add_header("X-Aws-Parameters-Secrets-Token", token)
    config = json.loads(urllib.request.urlopen(request).read())
    return config["Parameter"]["Value"]


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


def get_sagemaker_models():
    return parameters.get_parameter(MODELS_PARAMETER_NAME, transform="json", max_age=30)
