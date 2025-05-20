import json
from unittest.mock import MagicMock, patch

import pytest

# Mock configuration for tests
mock_config = {
    "bedrock": {"region": "us-east-1"},
    "nexus": {"enabled": False},
    "rag": {
        "embeddingsModels": [
            {
                "name": "titan-embed",
                "provider": "bedrock",
                "dimensions": 1536,
                "maxInputLength": 8000,
            },
            {
                "name": "cohere-embed",
                "provider": "bedrock",
                "dimensions": 1024,
                "maxInputLength": 4000,
            },
        ]
    },
}


# Create patches for all AWS service calls
@pytest.fixture(autouse=True, scope="function")
def mock_aws_services():
    """Mock AWS services to prevent real API calls during testing"""
    # Create all the patches
    patches = []

    # Patch SSM Provider get method directly
    ssm_get_patch = patch(
        "aws_lambda_powertools.utilities.parameters.base.BaseProvider.get"
    )
    mock_ssm_get = ssm_get_patch.start()
    mock_ssm_get.return_value = json.dumps(mock_config)
    patches.append(ssm_get_patch)

    # Patch get_parameter
    get_parameter_patch = patch(
        "aws_lambda_powertools.utilities.parameters.get_parameter"
    )
    mock_get_parameter = get_parameter_patch.start()
    mock_get_parameter.return_value = json.dumps(mock_config)
    patches.append(get_parameter_patch)

    # Patch get_secret
    get_secret_patch = patch("aws_lambda_powertools.utilities.parameters.get_secret")
    mock_get_secret = get_secret_patch.start()
    mock_get_secret.return_value = {"headerValue": "test-value"}
    patches.append(get_secret_patch)

    # Patch genai_core.parameters.get_config
    get_config_patch = patch("genai_core.parameters.get_config")
    mock_get_config = get_config_patch.start()
    mock_get_config.return_value = mock_config
    patches.append(get_config_patch)

    # Patch genai_core.parameters.get_sagemaker_models
    get_sagemaker_models_patch = patch("genai_core.parameters.get_sagemaker_models")
    mock_get_sagemaker_models = get_sagemaker_models_patch.start()
    mock_get_sagemaker_models.return_value = []
    patches.append(get_sagemaker_models_patch)

    # Patch genai_core.clients.is_nexus_configured
    is_nexus_configured_patch = patch("genai_core.clients.is_nexus_configured")
    mock_is_nexus_configured = is_nexus_configured_patch.start()
    mock_is_nexus_configured.return_value = (False, {})
    patches.append(is_nexus_configured_patch)

    # Patch genai_core.clients.get_bedrock_client
    get_bedrock_client_patch = patch("genai_core.clients.get_bedrock_client")
    mock_get_bedrock_client = get_bedrock_client_patch.start()
    mock_get_bedrock_client.return_value = MagicMock()
    patches.append(get_bedrock_client_patch)

    # Patch boto3.client
    boto3_client_patch = patch("boto3.client")
    mock_boto3_client = boto3_client_patch.start()
    mock_boto3_client.return_value = MagicMock()
    patches.append(boto3_client_patch)

    # Yield to allow tests to run
    yield

    # Stop all patches after tests complete
    for p in patches:
        p.stop()
