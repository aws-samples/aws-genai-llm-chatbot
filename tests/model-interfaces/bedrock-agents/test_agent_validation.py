from unittest.mock import patch, Mock

# Import using conftest.py path setup
from bedrock_agents_core import validate_agent_id


@patch("genai_core.clients.get_agentcore_client")
def test_validate_agent_id_valid_simple(mock_client):
    mock_client.return_value = Mock()
    # Simple IDs are no longer valid - only ARNs are accepted
    assert validate_agent_id("test-agent-123") == False


@patch("genai_core.clients.get_agentcore_client")
def test_validate_agent_id_valid_arn(mock_client):
    mock_client.return_value = Mock()
    assert (
        validate_agent_id(
            "arn:aws:bedrock-agentcore:us-east-1:123456789012:runtime/test-agent"
        )
        == True
    )


@patch("genai_core.clients.get_agentcore_client")
def test_validate_agent_id_invalid_empty(mock_client):
    mock_client.return_value = Mock()
    assert validate_agent_id("") == False
    assert validate_agent_id(None) == False


@patch("genai_core.clients.get_agentcore_client")
def test_validate_agent_id_invalid_injection(mock_client):
    mock_client.return_value = Mock()
    assert validate_agent_id("../../../etc/passwd") == False
    assert validate_agent_id("agent'; DROP TABLE sessions; --") == False


@patch("genai_core.clients.get_agentcore_client")
def test_validate_agent_id_invalid_too_long(mock_client):
    mock_client.return_value = Mock()
    assert validate_agent_id("a" * 101) == False
