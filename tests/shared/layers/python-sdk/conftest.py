import json
import os
from unittest.mock import patch, MagicMock

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

# Set environment variables needed by the code
os.environ["CONFIG_PARAMETER_NAME"] = "test-config-param"
os.environ["MODELS_PARAMETER_NAME"] = "test-models-param"
os.environ["API_KEYS_SECRETS_ARN"] = "test-api-keys-arn"
os.environ["X_ORIGIN_VERIFY_SECRET_ARN"] = "test-origin-verify-arn"

# Apply patches at module level
patches = []

# Patch SSM Provider get method directly
ssm_get_patch = patch("aws_lambda_powertools.utilities.parameters.ssm.SSMProvider.get")
mock_ssm_get = ssm_get_patch.start()
mock_ssm_get.return_value = json.dumps(mock_config)
patches.append(ssm_get_patch)

# Patch SSM Provider _get method
ssm_get_internal_patch = patch(
    "aws_lambda_powertools.utilities.parameters.ssm.SSMProvider._get"
)
mock_ssm_get_internal = ssm_get_internal_patch.start()
mock_ssm_get_internal.return_value = json.dumps(mock_config)
patches.append(ssm_get_internal_patch)

# Patch get_parameter
get_parameter_patch = patch("aws_lambda_powertools.utilities.parameters.get_parameter")
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

# Patch boto3.resource
boto3_resource_patch = patch("boto3.resource")
mock_boto3_resource = boto3_resource_patch.start()
mock_boto3_resource.return_value = MagicMock()
patches.append(boto3_resource_patch)

# Patch boto3.session.Session
boto3_session_patch = patch("boto3.session.Session")
mock_boto3_session = boto3_session_patch.start()
mock_boto3_session.return_value = MagicMock()
patches.append(boto3_session_patch)


# Clean up patches after all tests
def pytest_sessionfinish(session, exitstatus):
    for p in patches:
        p.stop()
