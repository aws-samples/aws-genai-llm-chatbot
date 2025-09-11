from unittest.mock import Mock, patch
from botocore.exceptions import ClientError

from genai_core.agents import list_agents


@patch("genai_core.clients.get_agentcore_control_client")
def test_list_agents_success(mock_client):
    mock_bedrock = Mock()
    mock_bedrock.list_agent_runtimes.return_value = {
        "agentRuntimes": [{"agentRuntimeId": "test-agent"}]
    }
    mock_client.return_value = mock_bedrock

    result = list_agents()
    assert len(result) == 1
    assert result[0]["agentRuntimeId"] == "test-agent"


@patch("genai_core.clients.get_agentcore_control_client")
def test_list_agents_client_error(mock_client):
    mock_bedrock = Mock()
    mock_bedrock.list_agent_runtimes.side_effect = ClientError(
        {"Error": {"Code": "AccessDenied"}}, "list_agent_runtimes"
    )
    mock_client.return_value = mock_bedrock

    result = list_agents()
    assert result == []
