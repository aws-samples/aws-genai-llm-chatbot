import pytest
from unittest.mock import Mock, patch
from botocore.exceptions import ClientError
# Import using conftest.py path setup
from index import handle_run

@patch('genai_core.clients.get_agentcore_client')
@patch('index.send_to_client')
def test_handle_run_invalid_agent_id(mock_send, mock_client):
    """Test handling of invalid agent ID"""
    mock_client.return_value = Mock()
    
    record = {
        "userId": "test-user",
        "userGroups": ["user"],
        "data": {"agentId": "invalid/../agent", "text": "test"}
    }

    handle_run(record, Mock())

    # Verify error message sent to client
    mock_send.assert_called()
    call_args = mock_send.call_args[0][0]
    assert call_args["action"] == "error"
    assert "Invalid request parameters" in call_args["data"]["content"]

@patch('genai_core.clients.get_agentcore_client')
@patch('index.send_to_client')
@patch('index.validate_agent_id')
def test_handle_run_json_decode_error(mock_validate, mock_send, mock_client):
    """Test handling of JSON parsing errors"""
    
    record = {
        "userId": "test-user",
        "userGroups": ["user"],
        "data": {"agentId": "valid-agent", "text": "test"}
    }

    mock_validate.return_value = True
    mock_bedrock = Mock()
    mock_bedrock.invoke_agent_runtime.return_value = {
        'completion': 'invalid-json-response'
    }
    mock_client.return_value = mock_bedrock

    handle_run(record, Mock())

    # Should handle JSON parsing gracefully
    mock_send.assert_called()

@patch('genai_core.clients.get_agentcore_client')
@patch('index.send_to_client')
@patch('index.validate_agent_id')
def test_handle_run_timeout_error(mock_validate, mock_send, mock_client):
    """Test handling of timeout scenarios"""
    
    record = {
        "userId": "test-user", 
        "userGroups": ["user"],
        "data": {"agentId": "valid-agent", "text": "test"}
    }

    mock_validate.return_value = True
    mock_bedrock = Mock()
    mock_bedrock.invoke_agent_runtime.side_effect = ClientError(
        {"Error": {"Code": "TimeoutError"}}, "invoke_agent_runtime"
    )
    mock_client.return_value = mock_bedrock

    handle_run(record, Mock())

    mock_send.assert_called()
    call_args = mock_send.call_args[0][0]
    assert call_args["action"] == "error"
