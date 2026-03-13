import pytest
from unittest.mock import patch, MagicMock
import json


@pytest.fixture
def sample_message():
    return {
        "type": "text",
        "action": "llm_new_token",
        "userId": "test-user-123",
        "timestamp": "1234567890",
        "data": {
            "sessionId": "test-session-456",
            "token": {"runId": "run-789", "sequenceNumber": 1, "value": "Hello"},
        },
        "direction": "OUT",
    }


@patch("genai_core.utils.appsync.requests.request")
@patch("genai_core.utils.appsync.boto3.Session")
def test_direct_send_formats_mutation_correctly(mock_session, mock_request, sample_message):
    """Test that direct_send_to_client formats GraphQL mutation correctly"""
    from genai_core.utils.appsync import direct_send_to_client
    
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.content = json.dumps({"data": {"publishResponse": {"data": "success"}}}).encode()
    mock_request.return_value = mock_response
    
    mock_credentials = MagicMock()
    mock_session.return_value.get_credentials.return_value = mock_credentials
    
    response = direct_send_to_client(sample_message)
    
    assert response.status_code == 200
    assert mock_request.called
    
    # Verify mutation structure
    call_args = mock_request.call_args
    payload = json.loads(call_args[1]["data"])
    assert "mutation Mutation" in payload["query"]
    assert "publishResponse" in payload["query"]


@patch("genai_core.utils.appsync.requests.request")
@patch("genai_core.utils.appsync.boto3.Session")
def test_direct_send_handles_errors(mock_session, mock_request, sample_message):
    """Test that direct_send_to_client handles errors gracefully"""
    from genai_core.utils.appsync import direct_send_to_client
    
    mock_request.side_effect = Exception("Network error")
    mock_credentials = MagicMock()
    mock_session.return_value.get_credentials.return_value = mock_credentials
    
    with pytest.raises(Exception, match="Network error"):
        direct_send_to_client(sample_message)
