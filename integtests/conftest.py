import json
import os

from urllib.request import urlopen

import pytest

from clients.cognito_client import CognitoClient
from clients.appsync_client import AppSyncClient

@pytest.fixture(scope="session")
def client(config):
    user_pool_id = config.get("aws_user_pools_id")
    region = config.get("aws_cognito_region")
    user_pool_client_id = config.get("aws_user_pools_web_client_id")
    endpoint = config.get("aws_appsync_graphqlEndpoint")
    
    cognito = CognitoClient(region=region, user_pool_id=user_pool_id, client_id=user_pool_client_id)
    email = "integ-test-user@example.local"
    
    return AppSyncClient(endpoint=endpoint, id_token=cognito.get_token(email=email))

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
def config():
    if "REACT_APP_URL" not in os.environ:
        raise IndexError("Please set the environment variable REACT_APP_URL")
    response = urlopen(os.environ['REACT_APP_URL'] + "/aws-exports.json")
    return json.loads(response.read())
