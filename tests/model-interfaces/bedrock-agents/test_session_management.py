from unittest.mock import Mock, patch
import os

# Import using conftest.py path setup
from bedrock_agents_core import get_conversation_history, save_session_history

# Mock environment
os.environ["SESSIONS_TABLE_NAME"] = "test-table"


@patch("genai_core.clients.get_agentcore_client")
@patch("bedrock_agents_core.DynamoDBChatMessageHistory")
def test_get_conversation_history_with_limit(mock_history_class, mock_client):
    """Test conversation history respects message limit"""
    mock_client.return_value = Mock()

    mock_history = Mock()
    # Create mock messages with type and content attributes
    mock_messages = []
    for i in range(25):
        msg = Mock()
        msg.type = "human" if i % 2 == 0 else "ai"
        msg.content = f"Message {i}"
        mock_messages.append(msg)

    mock_history.messages = mock_messages
    mock_history_class.return_value = mock_history

    result = get_conversation_history("session1", "user1", max_messages=20)

    # Should only return last 20 messages as dictionaries
    assert len(result) == 20
    # Check that messages are converted to dict format
    expected = []
    for msg in mock_messages[-20:]:
        role = "user" if msg.type == "human" else "assistant"
        expected.append({"role": role, "content": msg.content})
    assert result == expected


@patch("genai_core.clients.get_agentcore_client")
@patch("bedrock_agents_core.DynamoDBChatMessageHistory")
def test_get_conversation_history_empty(mock_history_class, mock_client):
    """Test conversation history with no messages"""
    mock_client.return_value = Mock()

    mock_history = Mock()
    mock_history.messages = []
    mock_history_class.return_value = mock_history

    result = get_conversation_history("session1", "user1")

    assert result == []


@patch("genai_core.clients.get_agentcore_client")
@patch("bedrock_agents_core.DynamoDBChatMessageHistory")
def test_save_session_history_success(mock_history_class, mock_client):
    """Test successful session history save"""
    mock_client.return_value = Mock()

    mock_history = Mock()
    mock_history.add_user_message.return_value = None
    mock_history.add_ai_message.return_value = None
    mock_history_class.return_value = mock_history

    result = save_session_history("session1", "user1", "test prompt", "test response")

    assert result == True
    mock_history.add_user_message.assert_called_once_with("test prompt")
    mock_history.add_ai_message.assert_called_once_with("test response")


@patch("genai_core.clients.get_agentcore_client")
@patch("bedrock_agents_core.DynamoDBChatMessageHistory")
def test_save_session_history_error_recovery(mock_history_class, mock_client):
    """Test error recovery when AI message fails to save"""
    mock_client.return_value = Mock()

    mock_history = Mock()
    mock_history.add_user_message.return_value = None
    mock_history.add_ai_message.side_effect = [Exception("DB Error"), None]
    mock_history_class.return_value = mock_history

    # Should not raise exception, should attempt recovery
    result = save_session_history("session1", "user1", "test prompt", "test response")

    assert result == False  # Should return False due to error
    mock_history.add_user_message.assert_called_once_with("test prompt")
    # Verify recovery attempt was made
    assert mock_history.add_ai_message.call_count == 2
