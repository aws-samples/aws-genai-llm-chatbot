import os
import json
import pytest
from unittest.mock import Mock, patch

# Import the modules to test
from genai_core.bedrock_agent.client import (
    extract_text_from_dict_event,
    extract_text_from_object_event,
    process_event_stream,
    get_bedrock_client,
    get_bedrock_agent_client,
    get_agent_config,
    list_agents,
    select_agent,
    invoke_agent_by_id,
    extract_completion_from_event_stream,
    extract_metadata_from_response,
    process_completion_value,
    extract_completion_from_response,
    invoke_agent,
)
from genai_core.types import CommonError


class TestTextExtraction:
    """Test text extraction functions"""

    def test_extract_text_from_dict_event_with_chunk_bytes(self):
        """Test extracting text from dict event with chunk bytes"""
        event = {"chunk": {"bytes": b"test response"}}

        with patch("genai_core.bedrock_agent.client.logger") as mock_logger:
            result = extract_text_from_dict_event(event)

        assert result == "test response"
        mock_logger.info.assert_called()

    def test_extract_text_from_dict_event_with_chunk_text(self):
        """Test extracting text from dict event with chunk text"""
        event = {"chunk": {"text": "direct text response"}}

        with patch("genai_core.bedrock_agent.client.logger"):
            result = extract_text_from_dict_event(event)

        assert result == "direct text response"

    def test_extract_text_from_dict_event_with_direct_text(self):
        """Test extracting text from dict event with direct text"""
        event = {"text": "direct text"}

        result = extract_text_from_dict_event(event)
        assert result == "direct text"

    def test_extract_text_from_dict_event_with_bytes(self):
        """Test extracting text from dict event with direct bytes"""
        event = {"bytes": b"bytes text"}

        result = extract_text_from_dict_event(event)
        assert result == "bytes text"

    def test_extract_text_from_dict_event_with_payload(self):
        """Test extracting text from dict event with JSON payload"""
        payload_data = {"text": "payload text"}
        event = {"payload": json.dumps(payload_data).encode("utf-8")}

        result = extract_text_from_dict_event(event)
        assert result == "payload text"

    def test_extract_text_from_dict_event_with_content(self):
        """Test extracting text from dict event with content"""
        event = {"content": "content text"}

        result = extract_text_from_dict_event(event)
        assert result == "content text"

    def test_extract_text_from_dict_event_with_message(self):
        """Test extracting text from dict event with message"""
        event = {"message": "message text"}

        result = extract_text_from_dict_event(event)
        assert result == "message text"

    def test_extract_text_from_dict_event_empty(self):
        """Test extracting text from empty dict event"""
        event = {}

        result = extract_text_from_dict_event(event)
        assert result == ""

    def test_extract_text_from_object_event_with_chunk_bytes(self):
        """Test extracting text from object event with chunk bytes"""
        event = Mock()
        event.chunk = Mock()
        event.chunk.bytes = b"object chunk bytes"
        event.chunk.text = None

        with patch("genai_core.bedrock_agent.client.logger"):
            result = extract_text_from_object_event(event)

        assert result == "object chunk bytes"

    def test_extract_text_from_object_event_with_chunk_text(self):
        """Test extracting text from object event with chunk text"""
        event = Mock()
        event.chunk = Mock()
        event.chunk.text = "object chunk text"
        event.chunk.bytes = None

        result = extract_text_from_object_event(event)
        assert result == "object chunk text"

    def test_extract_text_from_object_event_with_direct_text(self):
        """Test extracting text from object event with direct text"""
        event = Mock()
        event.chunk = None
        event.text = "direct object text"

        result = extract_text_from_object_event(event)
        assert result == "direct object text"

    def test_extract_text_from_object_event_with_completion(self):
        """Test extracting text from object event with completion"""
        event = Mock()
        event.chunk = None
        event.text = None
        event.bytes = None
        event.completion = Mock()
        event.completion.text = "completion text"

        result = extract_text_from_object_event(event)
        assert result == "completion text"

    def test_process_event_stream_with_string(self):
        """Test processing event stream that's already a string"""
        result = process_event_stream("already a string")
        assert result == "already a string"

    def test_process_event_stream_with_none(self):
        """Test processing None event stream"""
        result = process_event_stream(None)
        assert result == ""

    def test_process_event_stream_with_iterable(self):
        """Test processing event stream with iterable events"""
        events = [{"text": "first "}, {"text": "second"}]

        with patch("genai_core.bedrock_agent.client.logger"):
            result = process_event_stream(events)

        assert result == "first second"


class TestBedrockClients:
    """Test Bedrock client creation functions"""

    @patch("boto3.client")
    @patch("botocore.config.Config")
    def test_get_bedrock_client_default(self, mock_config, mock_boto_client):
        """Test getting bedrock client with default parameters"""
        mock_client = Mock()
        mock_boto_client.return_value = mock_client

        with patch.dict(os.environ, {"BEDROCK_REGION": "us-west-2"}):
            result = get_bedrock_client()

        mock_boto_client.assert_called_once()
        call_args = mock_boto_client.call_args[1]
        assert call_args["service_name"] == "bedrock"
        assert call_args["region_name"] == "us-west-2"
        assert result == mock_client

    @patch("boto3.client")
    @patch("genai_core.bedrock_agent.client.sts_client")
    def test_get_bedrock_client_with_role(self, mock_sts, mock_boto_client):
        """Test getting bedrock client with role assumption"""
        mock_client = Mock()
        mock_boto_client.return_value = mock_client

        # Mock STS assume role response
        mock_sts.assume_role.return_value = {
            "Credentials": {
                "AccessKeyId": "test-key",
                "SecretAccessKey": "test-secret",
                "SessionToken": "test-token",
            }
        }

        with patch.dict(
            os.environ,
            {
                "BEDROCK_REGION": "us-east-1",
                "BEDROCK_ROLE_ARN": "arn:aws:iam::123456789012:role/test-role",
            },
        ):
            get_bedrock_client(service_name="bedrock-agent-runtime")

        mock_sts.assume_role.assert_called_once()
        mock_boto_client.assert_called_once()
        call_args = mock_boto_client.call_args[1]
        assert call_args["service_name"] == "bedrock-agent-runtime"
        assert call_args["aws_access_key_id"] == "test-key"
        assert call_args["aws_secret_access_key"] == "test-secret"
        assert call_args["aws_session_token"] == "test-token"

    @patch("genai_core.bedrock_agent.client.get_bedrock_client")
    def test_get_bedrock_agent_client_success(self, mock_get_client):
        """Test getting bedrock agent client successfully"""
        mock_client = Mock()
        mock_get_client.return_value = mock_client

        with patch.dict(os.environ, {"BEDROCK_AGENT_ID": "test-agent-id"}):
            result = get_bedrock_agent_client()

        mock_get_client.assert_called_once_with(
            service_name="bedrock-agent-runtime", timeout=30
        )
        assert result == mock_client

    def test_get_bedrock_agent_client_no_agent_id(self):
        """Test getting bedrock agent client without agent ID"""
        with patch.dict(os.environ, {}, clear=True):
            with pytest.raises(CommonError, match="Bedrock Agent is not enabled"):
                get_bedrock_agent_client()

    def test_get_agent_config_success(self):
        """Test getting agent config successfully"""
        with patch.dict(
            os.environ,
            {
                "BEDROCK_AGENT_ID": "test-agent-id",
                "BEDROCK_AGENT_VERSION": "v1",
                "BEDROCK_AGENT_ALIAS_ID": "test-alias",
            },
        ):
            result = get_agent_config()

        assert result == {
            "agentId": "test-agent-id",
            "agentVersion": "v1",
            "agentAliasId": "test-alias",
        }

    def test_get_agent_config_defaults(self):
        """Test getting agent config with defaults"""
        with patch.dict(os.environ, {"BEDROCK_AGENT_ID": "test-agent-id"}):
            result = get_agent_config()

        assert result == {
            "agentId": "test-agent-id",
            "agentVersion": "DRAFT",
            "agentAliasId": None,
        }

    def test_get_agent_config_no_agent_id(self):
        """Test getting agent config without agent ID"""
        with patch.dict(os.environ, {}, clear=True):
            with pytest.raises(CommonError, match="Bedrock Agent is not enabled"):
                get_agent_config()


class TestAgentManagement:
    """Test agent management functions"""

    @patch("genai_core.bedrock_agent.client.get_bedrock_client")
    def test_list_agents_success(self, mock_get_client):
        """Test listing agents successfully"""
        mock_client = Mock()
        mock_get_client.return_value = mock_client

        # Mock list_agents response
        mock_client.list_agents.return_value = {
            "agentSummaries": [
                {
                    "agentId": "agent-1",
                    "agentName": "Test Agent 1",
                    "agentStatus": "PREPARED",
                    "createdAt": "2023-01-01",
                    "updatedAt": "2023-01-02",
                }
            ]
        }

        # Mock list_agent_aliases response
        mock_client.list_agent_aliases.return_value = {
            "agentAliasSummaries": [
                {
                    "agentAliasId": "alias-1",
                    "agentAliasName": "Test Alias",
                    "routingConfiguration": {},
                }
            ]
        }

        # Mock list_agent_versions response
        mock_client.list_agent_versions.return_value = {
            "agentVersionSummaries": [
                {
                    "agentVersion": "v1",
                    "agentStatus": "PREPARED",
                    "createdAt": "2023-01-01",
                }
            ]
        }

        with patch("genai_core.bedrock_agent.client.logger"):
            result = list_agents()

        assert len(result) == 1
        assert result[0]["agentId"] == "agent-1"
        assert result[0]["agentName"] == "Test Agent 1"
        assert len(result[0]["aliases"]) == 1
        assert len(result[0]["versions"]) == 1

    @patch("genai_core.bedrock_agent.client.get_bedrock_client")
    def test_list_agents_with_errors(self, mock_get_client):
        """Test listing agents with alias/version errors"""
        mock_client = Mock()
        mock_get_client.return_value = mock_client

        # Mock list_agents response
        mock_client.list_agents.return_value = {
            "agentSummaries": [
                {
                    "agentId": "agent-1",
                    "agentName": "Test Agent 1",
                    "agentStatus": "PREPARED",
                }
            ]
        }

        # Mock errors for aliases and versions
        mock_client.list_agent_aliases.side_effect = Exception("Alias error")
        mock_client.list_agent_versions.side_effect = Exception("Version error")

        with patch("genai_core.bedrock_agent.client.logger") as mock_logger:
            result = list_agents()

        assert len(result) == 1
        assert result[0]["aliases"] == []
        assert result[0]["versions"] == []
        mock_logger.error.assert_called()

    @patch("genai_core.bedrock_agent.client.get_bedrock_client")
    def test_list_agents_client_error(self, mock_get_client):
        """Test listing agents with client error"""
        mock_client = Mock()
        mock_get_client.return_value = mock_client
        mock_client.list_agents.side_effect = Exception("Client error")

        with pytest.raises(CommonError, match="Error listing Bedrock agents"):
            list_agents()

    def test_select_agent_by_id(self):
        """Test selecting agent by ID"""
        agents = [
            {"agentId": "agent-1", "agentName": "Agent 1"},
            {"agentId": "agent-2", "agentName": "Agent 2"},
        ]

        result = select_agent(agents, agent_id="agent-2")
        assert result["agentId"] == "agent-2"

    def test_select_agent_by_name(self):
        """Test selecting agent by name"""
        agents = [
            {"agentId": "agent-1", "agentName": "Agent 1"},
            {"agentId": "agent-2", "agentName": "Agent 2"},
        ]

        result = select_agent(agents, agent_name="Agent 1")
        assert result["agentName"] == "Agent 1"

    def test_select_agent_default(self):
        """Test selecting first agent by default"""
        agents = [
            {"agentId": "agent-1", "agentName": "Agent 1"},
            {"agentId": "agent-2", "agentName": "Agent 2"},
        ]

        result = select_agent(agents)
        assert result["agentId"] == "agent-1"

    def test_select_agent_empty_list(self):
        """Test selecting agent from empty list"""
        result = select_agent([])
        assert result is None


class TestAgentInvocation:
    """Test agent invocation functions"""

    @patch("genai_core.bedrock_agent.client.get_bedrock_client")
    @patch("genai_core.bedrock_agent.client.extract_completion_from_response")
    @patch("genai_core.bedrock_agent.client.extract_metadata_from_response")
    def test_invoke_agent_by_id_with_alias(
        self, mock_extract_metadata, mock_extract_completion, mock_get_client
    ):
        """Test invoking agent by ID with alias"""
        mock_client = Mock()
        mock_get_client.return_value = mock_client

        # Mock agent client for getting aliases
        mock_agent_client = Mock()
        mock_agent_client.list_agent_aliases.return_value = {
            "agentAliasSummaries": [{"agentAliasId": "alias-1"}]
        }

        mock_response_stream = Mock()
        mock_client.invoke_agent.return_value = mock_response_stream

        mock_extract_completion.return_value = "Test completion"
        mock_extract_metadata.return_value = {"trace": {}, "sessionAttributes": {}}

        # When alias_id is provided, only one client call is made
        mock_get_client.return_value = mock_client

        result = invoke_agent_by_id(
            agent_id="test-agent",
            agent_alias_id="alias-1",  # Provide alias ID to avoid the alias lookup
            session_id="test-session",
            prompt="test prompt",
        )

        assert result["completion"] == "Test completion"
        mock_client.invoke_agent.assert_called_once()

    @patch("genai_core.bedrock_agent.client.get_bedrock_client")
    @patch("genai_core.bedrock_agent.client.extract_completion_from_response")
    @patch("genai_core.bedrock_agent.client.extract_metadata_from_response")
    def test_invoke_agent_by_id_with_version(
        self, mock_extract_metadata, mock_extract_completion, mock_get_client
    ):
        """Test invoking agent by ID with version as alias"""
        mock_client = Mock()
        mock_get_client.return_value = mock_client

        mock_response_stream = Mock()
        mock_client.invoke_agent.return_value = mock_response_stream

        mock_extract_completion.return_value = "Test completion"
        mock_extract_metadata.return_value = {"trace": {}, "sessionAttributes": {}}

        result = invoke_agent_by_id(
            agent_id="test-agent",
            agent_alias_id="v1",
            session_id="test-session",
            prompt="test prompt",
        )

        assert result["completion"] == "Test completion"
        mock_client.invoke_agent.assert_called_once()
        call_args = mock_client.invoke_agent.call_args[1]
        assert call_args["agentAliasId"] == "v1"

    @patch("genai_core.bedrock_agent.client.get_bedrock_client")
    def test_invoke_agent_by_id_error(self, mock_get_client):
        """Test invoking agent by ID with error"""
        mock_client = Mock()
        mock_get_client.return_value = mock_client
        mock_client.invoke_agent.side_effect = Exception("Invocation error")

        with pytest.raises(CommonError, match="Error invoking Bedrock Agent"):
            invoke_agent_by_id(
                agent_id="test-agent", session_id="test-session", prompt="test prompt"
            )

    @patch("genai_core.bedrock_agent.client.get_bedrock_agent_client")
    @patch("genai_core.bedrock_agent.client.get_agent_config")
    @patch("genai_core.bedrock_agent.client.extract_completion_from_response")
    @patch("genai_core.bedrock_agent.client.extract_metadata_from_response")
    def test_invoke_agent_with_alias(
        self,
        mock_extract_metadata,
        mock_extract_completion,
        mock_get_config,
        mock_get_client,
    ):
        """Test invoking default agent with alias"""
        mock_client = Mock()
        mock_get_client.return_value = mock_client

        mock_get_config.return_value = {
            "agentId": "test-agent",
            "agentAliasId": "test-alias",
        }

        mock_response_stream = Mock()
        mock_client.invoke_agent.return_value = mock_response_stream

        mock_extract_completion.return_value = "Default agent response"
        mock_extract_metadata.return_value = {"trace": {}, "sessionAttributes": {}}

        result = invoke_agent(session_id="test-session", prompt="test prompt")

        assert result["completion"] == "Default agent response"
        mock_client.invoke_agent.assert_called_once()
        call_args = mock_client.invoke_agent.call_args[1]
        assert call_args["agentAliasId"] == "test-alias"

    @patch("genai_core.bedrock_agent.client.get_bedrock_agent_client")
    @patch("genai_core.bedrock_agent.client.get_agent_config")
    def test_invoke_agent_error(self, mock_get_config, mock_get_client):
        """Test invoking default agent with error"""
        mock_client = Mock()
        mock_get_client.return_value = mock_client
        mock_get_config.return_value = {
            "agentId": "test-agent",
            "agentVersion": "DRAFT",
        }

        mock_client.invoke_agent.side_effect = Exception("Default agent error")

        with pytest.raises(CommonError, match="Error invoking Bedrock Agent"):
            invoke_agent(session_id="test-session", prompt="test prompt")


class TestResponseProcessing:
    """Test response processing functions"""

    def test_extract_completion_from_event_stream(self):
        """Test extracting completion from event stream"""
        mock_stream = ["chunk1", "chunk2"]

        with patch(
            "genai_core.bedrock_agent.client.process_event_stream"
        ) as mock_process:
            mock_process.return_value = "processed text"

            result = extract_completion_from_event_stream(mock_stream)

        assert result == "processed text"
        mock_process.assert_called_once_with(mock_stream)

    def test_extract_metadata_from_response_dict(self):
        """Test extracting metadata from response dictionary"""
        response = {"trace": {"step1": "data"}, "sessionAttributes": {"attr1": "value"}}

        result = extract_metadata_from_response(response)

        assert result["trace"] == {"step1": "data"}
        assert result["sessionAttributes"] == {"attr1": "value"}

    def test_extract_metadata_from_response_empty(self):
        """Test extracting metadata from empty response"""
        result = extract_metadata_from_response({})

        assert result["trace"] == {}
        assert result["sessionAttributes"] == {}

    def test_process_completion_value_string(self):
        """Test processing completion value that's already a string"""
        result = process_completion_value("already a string")
        assert result == "already a string"

    def test_process_completion_value_event_stream(self):
        """Test processing completion value that's an EventStream"""
        mock_stream = Mock()
        mock_stream.__class__.__name__ = "EventStream"

        with patch(
            "genai_core.bedrock_agent.client.extract_completion_from_event_stream"
        ) as mock_extract:
            mock_extract.return_value = "extracted text"

            result = process_completion_value(mock_stream)

        assert result == "extracted text"

    def test_process_completion_value_other(self):
        """Test processing completion value of other type"""
        result = process_completion_value(42)
        assert result == "42"

    def test_extract_completion_from_response_dict_with_completion(self):
        """Test extracting completion from response dict with completion key"""
        response = {"completion": "test completion"}

        with patch(
            "genai_core.bedrock_agent.client.process_completion_value"
        ) as mock_process:
            mock_process.return_value = "processed completion"

            result = extract_completion_from_response(response, "test prompt")

        assert result == "processed completion"

    def test_extract_completion_from_response_dict_with_error(self):
        """Test extracting completion from response dict with error"""
        response = {"error": {"message": "Test error message"}}

        result = extract_completion_from_response(response, "test prompt")

        assert (
            "I encountered an error while processing your request: Test error message"
            in result
        )

    def test_extract_completion_from_response_fallback(self):
        """Test extracting completion with fallback message"""
        response = {}

        with patch("genai_core.bedrock_agent.client.logger") as mock_logger:
            result = extract_completion_from_response(response, "test prompt")

        assert (
            "I'm sorry, but I encountered an issue while processing your request"
            in result
        )
        mock_logger.error.assert_called()

    def test_extract_completion_from_response_with_response_metadata(self):
        """Test extracting completion from response with ResponseMetadata"""
        response = {"ResponseMetadata": {"HTTPStatusCode": 500}}

        result = extract_completion_from_response(response, "test prompt")

        assert "The request to the Bedrock agent failed with status code 500" in result
