import pytest
from unittest.mock import Mock, patch
import os
# Import using conftest.py path setup
from index import get_conversation_history, save_session_history

# Mock environment
os.environ["SESSIONS_TABLE_NAME"] = "test-table"

@patch('genai_core.clients.get_agentcore_client')
@patch('index.DynamoDBChatMessageHistory')
def test_get_conversation_history_with_limit(mock_history_class, mock_client):
    """Test conversation history respects message limit"""
    mock_client.return_value = Mock()
    
    mock_history = Mock()
    mock_history.table.get_item.return_value = {
        "Item": {
            "History": [{"type": "human", "data": {"content": f"msg{i}"}} for i in range(25)]
        }
    }
    mock_history_class.return_value = mock_history

    result = get_conversation_history("session1", "user1", max_messages=20)

    # Should only return last 20 messages
    assert len(result) == 20

@patch('genai_core.clients.get_agentcore_client')
@patch('index.DynamoDBChatMessageHistory')
def test_get_conversation_history_empty(mock_history_class, mock_client):
    """Test conversation history with no messages"""
    mock_client.return_value = Mock()
    
    mock_history = Mock()
    mock_history.table.get_item.return_value = {"Item": {"History": []}}
    mock_history_class.return_value = mock_history

    result = get_conversation_history("session1", "user1")
    assert result == []

@patch('genai_core.clients.get_agentcore_client')
@patch('index.DynamoDBChatMessageHistory')
def test_save_session_history_success(mock_history_class, mock_client):
    """Test successful session history save"""
    mock_client.return_value = Mock()
    
    mock_history = Mock()
    mock_history.add_user_message.return_value = None
    mock_history.add_ai_message.return_value = None
    mock_history_class.return_value = mock_history

    save_session_history("session1", "user1", "test prompt", "test response")

    mock_history.add_user_message.assert_called_once_with("test prompt")
    mock_history.add_ai_message.assert_called_once_with("test response")

@patch('genai_core.clients.get_agentcore_client')
@patch('index.DynamoDBChatMessageHistory')
def test_save_session_history_error_recovery(mock_history_class, mock_client):
    """Test error recovery when AI message fails to save"""
    mock_client.return_value = Mock()
    
    mock_history = Mock()
    mock_history.add_user_message.return_value = None
    mock_history.add_ai_message.side_effect = [Exception("DB Error"), None]
    mock_history_class.return_value = mock_history

    # Should not raise exception, should attempt recovery
    save_session_history("session1", "user1", "test prompt", "test response")

    # Verify recovery attempt was made
    assert mock_history.add_ai_message.call_count == 2
