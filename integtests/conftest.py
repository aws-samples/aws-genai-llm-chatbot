import json
import os
import pytest

from urllib.request import urlopen
from selenium import webdriver
from clients.cognito_client import CognitoClient, Credentials
from clients.appsync_client import AppSyncClient


@pytest.fixture(scope="session")
def client(cognito_admin_credentials: Credentials, config):
    endpoint = config.get("aws_appsync_graphqlEndpoint")
    return AppSyncClient(endpoint=endpoint, id_token=cognito_admin_credentials.id_token)


@pytest.fixture(scope="session")
def client_user(cognito_user_credentials: Credentials, config):
    endpoint = config.get("aws_appsync_graphqlEndpoint")
    return AppSyncClient(endpoint=endpoint, id_token=cognito_user_credentials.id_token)


@pytest.fixture(scope="session")
def client_workspace_manager(
    cognito_workspace_manager_credentials: Credentials, config
):
    endpoint = config.get("aws_appsync_graphqlEndpoint")
    return AppSyncClient(
        endpoint=endpoint, id_token=cognito_workspace_manager_credentials.id_token
    )


def get_cognito_credentials(config, worker_id, role) -> Credentials:
    user_pool_id = config.get("aws_user_pools_id")
    region = config.get("aws_cognito_region")
    user_pool_client_id = config.get("aws_user_pools_web_client_id")
    identity_pool_id = config.get("aws_cognito_identity_pool_id")

    cognito = CognitoClient(
        region=region,
        user_pool_id=user_pool_id,
        client_id=user_pool_client_id,
        identity_pool_id=identity_pool_id,
    )
    email = "integ-test-user@example.local-" + role.replace("_", "-") + "-" + worker_id

    return cognito.get_credentials(email=email, role=role)


@pytest.fixture(scope="session")
def cognito_workspace_manager_credentials(config, worker_id) -> Credentials:
    return get_cognito_credentials(config, worker_id, "workspace_manager")


@pytest.fixture(scope="session")
def cognito_admin_credentials(config, worker_id) -> Credentials:
    return get_cognito_credentials(config, worker_id, "admin")


@pytest.fixture(scope="session")
def cognito_user_credentials(config, worker_id) -> Credentials:
    return get_cognito_credentials(config, worker_id, "user")


@pytest.fixture(scope="session")
def unauthenticated_client(config):
    endpoint = config.get("aws_appsync_graphqlEndpoint")
    return AppSyncClient(endpoint=endpoint, id_token=None)


@pytest.fixture(scope="session")
def default_model():
    return "anthropic.claude-instant-v1"


@pytest.fixture(scope="session")
def default_embed_model():
    return "amazon.titan-embed-text-v1"


@pytest.fixture(scope="session")
def default_multimodal_model():
    return "anthropic.claude-3-haiku-20240307-v1:0"


@pytest.fixture(scope="session")
def default_image_generation_model():
    return "amazon.nova-canvas-v1:0"


@pytest.fixture(scope="session")
def default_provider():
    return "bedrock"


@pytest.fixture(scope="session")
def config(react_url):
    response = urlopen(react_url + "/aws-exports.json")
    return json.loads(response.read())


@pytest.fixture(scope="session")
def react_url():
    if "REACT_APP_URL" not in os.environ:
        raise IndexError("Please set the environment variable REACT_APP_URL")
    return os.environ["REACT_APP_URL"]


@pytest.fixture(scope="module")
def selenium_driver(react_url):
    options = webdriver.FirefoxOptions()
    if os.getenv("HEADLESS"):
        options.add_argument("--headless")
    driver = webdriver.Remote(command_executor="http://127.0.0.1:4444", options=options)
    driver.set_window_size(1600, 800)
    driver.get(react_url)
    yield driver
    driver.close()
