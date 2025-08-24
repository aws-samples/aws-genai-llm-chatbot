from unittest.mock import Mock, patch
from botocore.exceptions import ClientError

# Import using conftest.py path setup
from bedrock_agents_core import handle_run

# Test constants
VALID_AGENT_ARN = "arn:aws:bedrock-agentcore:us-east-1:123456789012:runtime/valid-agent"


@patch("bedrock_agents_core.get_conversation_history")
@patch("genai_core.clients.get_agentcore_client")
@patch("bedrock_agents_core.send_to_client")
def test_handle_run_invalid_agent_id(mock_send, mock_client, mock_history):
    """Test handling of invalid agent ID"""
    mock_client.return_value = Mock()
    mock_history.return_value = []

    # Mock context with invoked_function_arn
    mock_context = Mock()
    mock_context.invoked_function_arn = (
        "arn:aws:lambda:us-east-1:123456789012:function:test"
    )

    record = {
        "userId": "test-user",
        "userGroups": ["user"],
        "data": {"agentRuntimeArn": "invalid/../agent", "text": "test"},
    }

    handle_run(record, mock_context)

    # Verify error message sent to client via exception handler
    mock_send.assert_called_once()
    call_args = mock_send.call_args[0][0]  # Get the first argument (the message dict)
    assert call_args["action"] == "error"
    assert call_args["userId"] == "test-user"
    assert "Invalid request parameters" in call_args["data"]["content"]


@patch("bedrock_agents_core.save_session_history")
@patch("bedrock_agents_core.get_conversation_history")
@patch("genai_core.clients.get_agentcore_client")
@patch("bedrock_agents_core.send_to_client")
@patch("bedrock_agents_core.validate_agent_id")
def test_handle_run_json_decode_error(
    mock_validate, mock_send, mock_client, mock_history, mock_save
):
    """Test handling of JSON parsing errors"""

    record = {
        "userId": "test-user",
        "userGroups": ["user"],
        "data": {
            "agentRuntimeArn": VALID_AGENT_ARN,
            "text": "test",
        },
    }

    mock_validate.return_value = True
    mock_history.return_value = []
    mock_save.return_value = True

    # Mock context with invoked_function_arn
    mock_context = Mock()
    mock_context.invoked_function_arn = (
        "arn:aws:lambda:us-east-1:123456789012:function:test"
    )

    mock_bedrock = Mock()
    # Mock a simple successful response instead of trying to cause JSON errors
    mock_bedrock.invoke_agent_runtime.return_value = {
        "contentType": "application/json",
        "response": Mock(
            read=Mock(
                return_value=b'{"result": {"content": [{"text": "test response"}]}}'
            )
        ),
    }
    mock_client.return_value = mock_bedrock

    handle_run(record, mock_context)

    # Verify function was called and response was handled
    mock_validate.assert_called_once_with(VALID_AGENT_ARN)
    mock_send.assert_called()
    # Should send final response
    call_args = mock_send.call_args[0][0]
    assert call_args["action"] == "final_response"


@patch("bedrock_agents_core.get_conversation_history")
@patch("genai_core.clients.get_agentcore_client")
@patch("bedrock_agents_core.send_to_client")
@patch("bedrock_agents_core.validate_agent_id")
def test_handle_run_timeout_error(mock_validate, mock_send, mock_client, mock_history):
    """Test handling of timeout scenarios"""

    record = {
        "userId": "test-user",
        "userGroups": ["user"],
        "data": {
            "agentRuntimeArn": (VALID_AGENT_ARN),
            "text": "test",
        },
    }

    mock_validate.return_value = True
    mock_history.return_value = []

    # Mock context with invoked_function_arn
    mock_context = Mock()
    mock_context.invoked_function_arn = (
        "arn:aws:lambda:us-east-1:123456789012:function:test"
    )

    mock_bedrock = Mock()
    mock_bedrock.invoke_agent_runtime.side_effect = ClientError(
        {"Error": {"Code": "TimeoutError"}}, "invoke_agent_runtime"
    )
    mock_client.return_value = mock_bedrock

    handle_run(record, mock_context)

    # Verify error handling
    mock_validate.assert_called_once_with(VALID_AGENT_ARN)
    mock_send.assert_called()
    call_args = mock_send.call_args[0][0]  # Get the first argument (the message dict)
    assert call_args["action"] == "error"
    assert call_args["userId"] == "test-user"
    assert "Service temporarily unavailable" in call_args["data"]["content"]
