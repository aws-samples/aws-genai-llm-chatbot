import json
import os
import pytest

from urllib.request import urlopen
from selenium import webdriver
from clients.cognito_client import CognitoClient, Credentials
from clients.appsync_client import AppSyncClient


@pytest.fixture(scope="session")
def client(cognito_credentials: Credentials, config):
    endpoint = config.get("aws_appsync_graphqlEndpoint")
    return AppSyncClient(endpoint=endpoint, id_token=cognito_credentials.id_token)


@pytest.fixture(scope="session")
def cognito_credentials(config, worker_id) -> Credentials:
    user_pool_id = config.get("aws_user_pools_id")
    region = config.get("aws_cognito_region")
    user_pool_client_id = config.get("aws_user_pools_web_client_id")

    cognito = CognitoClient(
        region=region, user_pool_id=user_pool_id, client_id=user_pool_client_id
    )
    email = "integ-test-user@example.local-" + worker_id

    return cognito.get_credentials(email=email)


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


@pytest.fixture(scope="class")
def selenium_driver(react_url):
    options = webdriver.FirefoxOptions()
    if os.getenv("HEADLESS"):
        options.add_argument("--headless")
    driver = webdriver.Remote(command_executor="http://127.0.0.1:4444", options=options)
    driver.set_window_size(1600, 800)
    driver.get(react_url)
    yield driver
    driver.close()
