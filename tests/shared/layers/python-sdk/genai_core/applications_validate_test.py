import pytest
from genai_core.types import CommonError

VALID_AGENT_ARN = "arn:aws:bedrock-agentcore:us-east-1:123456789012:runtime/my-agent"


def test_validate_request_valid_model(mocker):
    mocker.patch(
        "genai_core.models.list_models",
        return_value=[{"provider": "bedrock", "name": "claude-v3"}],
    )
    mocker.patch("genai_core.roles.list_roles", return_value=[{"name": "admin"}])
    from genai_core.applications import validate_request

    validate_request(workspace=None, roles=["admin"], model="bedrock::claude-v3")


def test_validate_request_valid_agent_arn(mocker):
    mocker.patch("genai_core.roles.list_roles", return_value=[{"name": "admin"}])
    from genai_core.applications import validate_request

    validate_request(
        workspace=None, roles=["admin"], model=None, agentRuntimeArn=VALID_AGENT_ARN
    )


def test_validate_request_invalid_agent_arn(mocker):
    mocker.patch("genai_core.roles.list_roles", return_value=[{"name": "admin"}])
    from genai_core.applications import validate_request

    with pytest.raises(CommonError, match="Invalid agent runtime ARN format"):
        validate_request(
            workspace=None, roles=["admin"], model=None, agentRuntimeArn="not-an-arn"
        )


def test_validate_request_no_model_no_agent(mocker):
    mocker.patch("genai_core.roles.list_roles", return_value=[{"name": "admin"}])
    from genai_core.applications import validate_request

    with pytest.raises(CommonError, match="Either model or agentRuntimeArn"):
        validate_request(workspace=None, roles=["admin"], model=None)


def test_validate_request_invalid_role(mocker):
    mocker.patch("genai_core.roles.list_roles", return_value=[{"name": "admin"}])
    from genai_core.applications import validate_request

    with pytest.raises(CommonError, match="Role not found"):
        validate_request(
            workspace=None,
            roles=["nonexistent"],
            model=None,
            agentRuntimeArn=VALID_AGENT_ARN,
        )


def test_validate_request_model_not_found(mocker):
    mocker.patch("genai_core.models.list_models", return_value=[])
    mocker.patch("genai_core.roles.list_roles", return_value=[{"name": "admin"}])
    from genai_core.applications import validate_request

    with pytest.raises(CommonError, match="Model not found"):
        validate_request(workspace=None, roles=["admin"], model="bedrock::nonexistent")


def test_validate_request_arn_injection_attempt(mocker):
    mocker.patch("genai_core.roles.list_roles", return_value=[{"name": "admin"}])
    from genai_core.applications import validate_request

    with pytest.raises(CommonError, match="Invalid agent runtime ARN format"):
        validate_request(
            workspace=None,
            roles=["admin"],
            model=None,
            agentRuntimeArn="arn:aws:bedrock-agentcore:us-east-1:123456789012:runtime/../../etc/passwd",
        )
