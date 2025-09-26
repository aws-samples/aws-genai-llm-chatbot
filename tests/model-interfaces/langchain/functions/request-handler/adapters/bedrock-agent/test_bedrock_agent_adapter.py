import os
import base64
import pytest
from unittest.mock import Mock, patch
from decimal import Decimal

# Import the modules to test
from adapters.bedrock_agent.agent import (
    BedrockAgentAdapter,
    extract_agent_info,
    json_dumps_decimal,
    CustomJSONEncoder,
)
from genai_core.types import FileStorageProvider, ChatbotMessageType


class TestBedrockAgentAdapter:
    """Comprehensive test suite for BedrockAgentAdapter"""

    @pytest.fixture
    def mock_environment(self):
        """Set up mock environment variables"""
        with patch.dict(
            os.environ,
            {
                "CHATBOT_FILES_BUCKET_NAME": "test-bucket",
                "SESSIONS_TABLE_NAME": "test-sessions-table",
                "BEDROCK_AGENT_ID": "test-agent-id",
                "BEDROCK_AGENT_VERSION": "DRAFT",
            },
        ):
            yield

    @pytest.fixture
    def adapter(self, mock_environment):
        """Create a BedrockAgentAdapter instance for testing"""
        with patch("genai_core.langchain.DynamoDBChatMessageHistory"):
            adapter = BedrockAgentAdapter(
                model_id="test-agent",
                session_id="test-session",
                user_id="test-user",
                mode="chain",
            )
            return adapter

    # Test extract_agent_info function
    def test_extract_agent_info_generic(self):
        """Test extraction with generic bedrock_agent model name"""
        result = extract_agent_info("bedrock_agent")
        assert result == (None, None, None)

    def test_extract_agent_info_specific_agent(self):
        """Test extraction with specific agent format"""
        result = extract_agent_info("Agent_Test_Agent_ABC123")
        assert result == ("ABC123", "Test Agent", None)

    def test_extract_agent_info_invalid_format(self):
        """Test extraction with invalid format"""
        result = extract_agent_info("invalid_format")
        assert result == (None, None, None)

    # Test json_dumps_decimal function
    def test_json_dumps_decimal_float(self):
        """Test conversion of float to Decimal"""
        result = json_dumps_decimal(3.14)
        assert isinstance(result, Decimal)
        assert result == Decimal("3.14")

    def test_json_dumps_decimal_bytes(self):
        """Test conversion of bytes to base64 string"""
        test_bytes = b"test data"
        result = json_dumps_decimal(test_bytes)
        expected = base64.b64encode(test_bytes).decode("utf-8")
        assert result == expected

    def test_json_dumps_decimal_dict(self):
        """Test recursive conversion of dictionary"""
        test_dict = {"float_val": 2.5, "bytes_val": b"data", "str_val": "text"}
        result = json_dumps_decimal(test_dict)

        assert isinstance(result["float_val"], Decimal)
        assert result["float_val"] == Decimal("2.5")
        assert result["bytes_val"] == base64.b64encode(b"data").decode("utf-8")
        assert result["str_val"] == "text"

    # Test CustomJSONEncoder
    def test_custom_json_encoder_bytes(self):
        """Test encoding bytes to base64"""
        encoder = CustomJSONEncoder()
        test_bytes = b"test data"
        result = encoder.default(test_bytes)
        expected = base64.b64encode(test_bytes).decode("utf-8")
        assert result == expected

    def test_custom_json_encoder_decimal(self):
        """Test encoding Decimal to float"""
        encoder = CustomJSONEncoder()
        test_decimal = Decimal("3.14")
        result = encoder.default(test_decimal)
        assert result == 3.14
        assert isinstance(result, float)

    # Test BedrockAgentAdapter initialization
    def test_adapter_initialization(self, mock_environment):
        """Test proper initialization of BedrockAgentAdapter"""
        with patch("genai_core.langchain.DynamoDBChatMessageHistory"):
            adapter = BedrockAgentAdapter(
                model_id="test-model",
                session_id="session-123",
                user_id="user-456",
                mode="test-mode",
                model_kwargs={"temperature": 0.5},
            )

            assert adapter.model_id == "test-model"
            assert adapter.session_id == "session-123"
            assert adapter.user_id == "user-456"
            assert adapter._mode == "test-mode"
            assert adapter.model_kwargs == {"temperature": 0.5}
            assert adapter.disable_streaming is True

    def test_get_llm_returns_none(self, adapter):
        """Test that get_llm returns None for Bedrock Agent"""
        result = adapter.get_llm()
        assert result is None

    def test_add_files_to_message_history_no_error(self, adapter):
        """Test that add_files_to_message_history doesn't raise error"""
        # Should not raise any exception
        adapter.add_files_to_message_history(
            images=[{"key": "test.jpg"}],
            documents=[{"key": "test.pdf"}],
            videos=[{"key": "test.mp4"}],
        )

    # Test S3 file operations
    def test_get_file_from_s3_success(self, adapter):
        """Test successful file retrieval from S3"""
        test_content = b"test file content"

        with patch("adapters.bedrock_agent.agent.s3") as mock_s3:
            mock_s3_object = Mock()
            mock_s3_object.get.return_value = {
                "Body": Mock(read=Mock(return_value=test_content))
            }
            mock_s3.Object.return_value = mock_s3_object

            file_info = {
                "provider": FileStorageProvider.S3.value,
                "key": "test.txt",
                "type": "document",
            }

            result = adapter.get_file_from_s3(file_info)

            assert result["type"] == "document"
            assert result["format"] == "txt"
            assert result["source"]["bytes"] == test_content

    def test_get_file_from_s3_unsupported_provider(self, adapter):
        """Test handling of unsupported file provider"""
        file_info = {"provider": "unsupported", "key": "test.txt", "type": "document"}

        result = adapter.get_file_from_s3(file_info)
        assert "error" in result
        assert result["error"] == "Unsupported file provider"

    # Test file processing
    def test_process_files_success(self, adapter):
        """Test successful file processing"""
        with patch.object(adapter, "get_file_from_s3") as mock_get_file:
            mock_get_file.return_value = {
                "type": "image",
                "format": "jpg",
                "source": {"bytes": b"image data"},
            }

            files = [{"key": "test.jpg", "type": "image"}]
            result = adapter._process_files(files)

            assert len(result) == 1
            assert result[0]["key"] == "test.jpg"
            assert result[0]["type"] == "image"

    def test_process_files_with_none(self, adapter):
        """Test _process_files with None input"""
        result = adapter._process_files(None)
        assert result is None

    # Test prompt preparation
    def test_prepare_file_prompt_no_files(self, adapter):
        """Test _prepare_file_prompt with no files"""
        with patch("adapters.bedrock_agent.agent.logger") as mock_logger:
            result = adapter._prepare_file_prompt("test prompt")

            assert result == "test prompt"
            mock_logger.info.assert_called_with(
                "No files present, returning original prompt without file information"
            )

    def test_prepare_file_prompt_with_images(self, adapter):
        """Test _prepare_file_prompt with images"""
        images = [{"key": "test.jpg", "format": "jpg", "type": "image"}]

        result = adapter._prepare_file_prompt("test prompt", images=images)

        assert "### UPLOADED FILES INFORMATION ###" in result
        assert "IMAGES:" in result
        assert "test.jpg" in result
        assert "s3://test-bucket" in result
        assert "### USER QUERY ###" in result
        assert "test prompt" in result

    def test_create_system_prompt_without_files(self, adapter):
        """Test _create_system_prompt without files"""
        result = adapter._create_system_prompt(has_files=False)

        assert "You are a helpful AI assistant" in result
        assert "S3 URIs" not in result

    def test_create_system_prompt_with_files(self, adapter):
        """Test _create_system_prompt with files"""
        result = adapter._create_system_prompt(has_files=True)

        assert "You are a helpful AI assistant" in result
        assert "S3 URIs" in result
        assert "test-bucket" in result
        assert "/get-file endpoint" in result

    # Test main run method
    @patch("genai_core.bedrock_agent.client.get_bedrock_agent_client")
    @patch("genai_core.bedrock_agent.client.extract_completion_from_response")
    @patch("genai_core.bedrock_agent.client.extract_metadata_from_response")
    @patch("adapters.bedrock_agent.agent.json_dumps_decimal")
    def test_run_with_default_agent(
        self,
        mock_json_dumps,
        mock_extract_metadata,
        mock_extract_completion,
        mock_get_client,
        adapter,
    ):
        """Test run method with default agent"""
        # Mock the bedrock client and its response
        mock_client = Mock()
        mock_get_client.return_value = mock_client
        mock_client.invoke_agent.return_value = Mock()

        # Mock the response processing
        mock_extract_completion.return_value = "Test response"
        mock_extract_metadata.return_value = {
            "trace": {"test": "trace"},
            "sessionAttributes": {},
        }
        mock_json_dumps.return_value = {"test": "trace"}

        # Mock chat history methods
        adapter.chat_history.add_user_message = Mock()
        adapter.chat_history.get_messages_from_storage = Mock(return_value=[])
        adapter.chat_history.table = Mock()
        adapter.chat_history.table.put_item = Mock()

        with patch("langchain.schema.messages_to_dict", return_value=[]):
            with patch("langchain.schema._message_to_dict", return_value={}):
                with patch("langchain_core.messages.AIMessage"):
                    result = adapter.run("test prompt")

        assert result["sessionId"] == "test-session"
        assert result["type"] == ChatbotMessageType.AI.value
        assert result["content"] == "Test response"
        mock_client.invoke_agent.assert_called_once()

    @patch("genai_core.bedrock_agent.invoke_agent_by_id")
    @patch("adapters.bedrock_agent.agent.json_dumps_decimal")
    def test_run_with_specific_agent(
        self, mock_json_dumps, mock_invoke_agent_by_id, adapter
    ):
        """Test run method with specific agent ID"""
        # Set up adapter with specific agent model ID
        adapter.model_id = "Agent_Test_Agent_ABC123"

        mock_invoke_agent_by_id.return_value = {
            "completion": "Specific agent response",
            "trace": {"agent": "specific"},
        }
        mock_json_dumps.return_value = {"agent": "specific"}

        # Mock chat history methods
        adapter.chat_history.add_user_message = Mock()
        adapter.chat_history.get_messages_from_storage = Mock(return_value=[])
        adapter.chat_history.table = Mock()
        adapter.chat_history.table.put_item = Mock()

        with patch("langchain.schema.messages_to_dict", return_value=[]):
            with patch("langchain.schema._message_to_dict", return_value={}):
                with patch("langchain_core.messages.AIMessage"):
                    result = adapter.run("test prompt")

        assert result["content"] == "Specific agent response"
        mock_invoke_agent_by_id.assert_called_once()

    @patch("genai_core.bedrock_agent.client.get_bedrock_agent_client")
    @patch("genai_core.bedrock_agent.client.extract_completion_from_response")
    @patch("genai_core.bedrock_agent.client.extract_metadata_from_response")
    def test_run_with_admin_user(
        self, mock_extract_metadata, mock_extract_completion, mock_get_client, adapter
    ):
        """Test run method with admin user groups"""
        # Mock the bedrock client and its response
        mock_client = Mock()
        mock_get_client.return_value = mock_client
        mock_client.invoke_agent.return_value = Mock()

        # Mock the response processing
        mock_extract_completion.return_value = "Admin response"
        mock_extract_metadata.return_value = {
            "trace": {"admin": "trace"},
            "sessionAttributes": {},
        }

        # Mock chat history methods
        adapter.chat_history.add_user_message = Mock()
        adapter.chat_history.get_messages_from_storage = Mock(return_value=[])
        adapter.chat_history.table = Mock()
        adapter.chat_history.table.put_item = Mock()

        with patch("langchain.schema.messages_to_dict", return_value=[]):
            with patch("langchain.schema._message_to_dict", return_value={}):
                with patch("langchain_core.messages.AIMessage"):
                    with patch(
                        "adapters.bedrock_agent.agent.json_dumps_decimal"
                    ) as mock_json:
                        mock_json.return_value = {"test": "metadata"}

                        result = adapter.run("test prompt", user_groups=["admin"])

        # Admin users should get full metadata
        assert "metadata" in result
        assert result["metadata"] != {"sessionId": "test-session"}

    @patch("genai_core.bedrock_agent.client.get_bedrock_agent_client")
    def test_run_exception_handling(self, mock_get_client, adapter):
        """Test run method exception handling"""
        mock_get_client.side_effect = Exception("Test error")

        adapter.chat_history.add_user_message = Mock()

        with pytest.raises(Exception):
            adapter.run("test prompt")

    # Integration test
    def test_end_to_end_file_processing(self, mock_environment):
        """Test complete file processing workflow"""
        with patch("genai_core.langchain.DynamoDBChatMessageHistory"):
            adapter = BedrockAgentAdapter(
                model_id="bedrock_agent",
                session_id="test-session",
                user_id="test-user",
            )

        # Mock S3 file retrieval
        with patch.object(adapter, "get_file_from_s3") as mock_get_file:
            mock_get_file.return_value = {
                "type": "image",
                "format": "jpg",
                "source": {"bytes": b"image data"},
                "key": "test.jpg",
            }

            # Mock the invoke_agent function at the import location in the adapter
            with patch(
                "adapters.bedrock_agent.agent.invoke_agent"
            ) as mock_invoke_agent:
                # Mock the response from invoke_agent
                mock_invoke_agent.return_value = {
                    "completion": "Processed image successfully",
                    "trace": {},
                    "sessionAttributes": {},
                }

                # Mock chat history
                adapter.chat_history.add_user_message = Mock()
                adapter.chat_history.get_messages_from_storage = Mock(return_value=[])
                adapter.chat_history.table = Mock()
                adapter.chat_history.table.put_item = Mock()

                with patch("langchain.schema.messages_to_dict", return_value=[]):
                    with patch("langchain.schema._message_to_dict", return_value={}):
                        with patch("langchain_core.messages.AIMessage"):
                            result = adapter.run(
                                "Analyze this image",
                                images=[
                                    {
                                        "key": "test.jpg",
                                        "type": "image",
                                        "provider": "s3",
                                    }
                                ],
                            )

                        # Verify the complete workflow
                        assert result["content"] == "Processed image successfully"
                        mock_get_file.assert_called_once()
                        mock_invoke_agent.assert_called_once()

                        # Verify enhanced prompt was created
                        call_args = mock_invoke_agent.call_args
                        enhanced_prompt = call_args[1]["prompt"]
                        assert "### UPLOADED FILES INFORMATION ###" in enhanced_prompt
                        assert "test.jpg" in enhanced_prompt
