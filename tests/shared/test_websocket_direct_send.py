import os
import pytest
from unittest.mock import patch, MagicMock, Mock
import sys

# Set required env vars before any imports
os.environ["AWS_REGION"] = "us-east-1"
os.environ["APPSYNC_ENDPOINT"] = "https://test.appsync-api.us-east-1.amazonaws.com/graphql"
os.environ["MESSAGES_TOPIC_ARN"] = "arn:aws:sns:us-east-1:123456789012:test-topic"

from genai_core.types import ChatbotAction


@pytest.fixture
def mock_env_direct_enabled(monkeypatch):
    monkeypatch.setenv("DIRECT_SEND", "true")


@pytest.fixture
def mock_env_direct_disabled(monkeypatch):
    monkeypatch.delenv("DIRECT_SEND", raising=False)
    # Reload module to pick up env change
    import importlib
    import genai_core.utils.websocket
    importlib.reload(genai_core.utils.websocket)


@patch("genai_core.utils.websocket.direct_send_to_client")
@patch("genai_core.utils.websocket.sns")
def test_direct_send_enabled_for_token(mock_sns, mock_direct_send, mock_env_direct_enabled):
    """Test that LLM_NEW_TOKEN uses direct send when enabled"""
    from genai_core.utils.websocket import send_to_client
    
    detail = {
        "action": ChatbotAction.LLM_NEW_TOKEN.value,
        "userId": "test-user",
        "data": {"sessionId": "test-session", "token": {"value": "test"}},
    }
    
    send_to_client(detail)
    
    mock_direct_send.assert_called_once_with(detail)
    mock_sns.publish.assert_not_called()


@patch("genai_core.utils.websocket.direct_send_to_client")
@patch("genai_core.utils.websocket.sns")
def test_direct_send_disabled_uses_sns(mock_sns, mock_direct_send, mock_env_direct_disabled):
    """Test that messages use SNS when direct send is disabled"""
    from genai_core.utils.websocket import send_to_client
    
    detail = {
        "action": ChatbotAction.LLM_NEW_TOKEN.value,
        "userId": "test-user",
        "data": {"sessionId": "test-session", "token": {"value": "test"}},
    }
    
    send_to_client(detail)
    
    mock_direct_send.assert_not_called()
    mock_sns.publish.assert_called_once()


@patch("genai_core.utils.websocket.direct_send_to_client")
@patch("genai_core.utils.websocket.sns")
def test_non_token_actions_use_sns(mock_sns, mock_direct_send, mock_env_direct_enabled):
    """Test that non-token actions always use SNS even when direct send is enabled"""
    from genai_core.utils.websocket import send_to_client
    
    for action in [ChatbotAction.HEARTBEAT.value, ChatbotAction.FINAL_RESPONSE.value]:
        detail = {
            "action": action,
            "userId": "test-user",
            "data": {"sessionId": "test-session"},
        }
        
        send_to_client(detail)
        
        mock_direct_send.assert_not_called()
        assert mock_sns.publish.called
        mock_sns.reset_mock()
