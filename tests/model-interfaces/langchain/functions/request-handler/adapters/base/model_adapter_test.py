import pytest
from unittest.mock import MagicMock, patch, call
from adapters.base import ModelAdapter
from genai_core.types import ChatbotMode
from langchain_aws import ChatBedrockConverse


class MockModelAdapter(ModelAdapter):
    def get_llm(self, model_kwargs={}):
        return ChatBedrockConverse()


@pytest.fixture
def model_adapter():
    with patch("genai_core.langchain.DynamoDBChatMessageHistory"), patch(
        "genai_core.clients.get_bedrock_client"
    ), patch("langchain.chains.conversation.base.ConversationChain"), patch(
        "langchain.chains.ConversationalRetrievalChain"
    ), patch(
        "langchain_aws.ChatBedrockConverse.__init__", return_value=None
    ):
        adapter = MockModelAdapter(
            session_id="test_session",
            user_id="test_user",
            mode=ChatbotMode.CHAIN.value,
            model_kwargs={},
        )
        return adapter


def test_run_chain_mode(model_adapter):
    model_adapter._mode = ChatbotMode.CHAIN.value
    model_adapter.run_with_chain_v2 = MagicMock(
        return_value={"content": "Test response"}
    )
    model_adapter.apply_bedrock_guardrails = MagicMock(return_value=None)

    result = model_adapter.run("Test prompt")

    assert result["content"] == "Test response"

    model_adapter.run_with_chain_v2.assert_called_once_with(
        "Test prompt", None, [], [], [], [], system_prompts={}
    )

    assert model_adapter.apply_bedrock_guardrails.call_count == 2
    model_adapter.apply_bedrock_guardrails.assert_has_calls(
        [
            call(source="INPUT", content="Test prompt"),
            call(source="OUTPUT", content="Test response"),
        ]
    )


def test_run_image_generation_mode(model_adapter):
    model_adapter._mode = ChatbotMode.IMAGE_GENERATION.value
    model_adapter.run_with_media_generation_chain = MagicMock(
        return_value={"content": "Image generated"}
    )
    model_adapter.apply_bedrock_guardrails = MagicMock(return_value=None)

    result = model_adapter.run("Generate an image")

    assert result["content"] == "Image generated"
    model_adapter.run_with_media_generation_chain.assert_called_once()
    model_adapter.apply_bedrock_guardrails.assert_called_with(
        source="INPUT", content="Generate an image"
    )


def test_run_video_generation_mode(model_adapter):
    model_adapter._mode = ChatbotMode.VIDEO_GENERATION.value
    model_adapter.run_with_media_generation_chain = MagicMock(
        return_value={"content": "Video generated"}
    )
    model_adapter.apply_bedrock_guardrails = MagicMock(return_value=None)

    result = model_adapter.run("Generate a video")

    assert result["content"] == "Video generated"
    model_adapter.run_with_media_generation_chain.assert_called_once()
    model_adapter.apply_bedrock_guardrails.assert_called_with(
        source="INPUT", content="Generate a video"
    )


def test_run_unknown_mode(model_adapter):
    model_adapter._mode = "UNKNOWN_MODE"
    model_adapter.apply_bedrock_guardrails = MagicMock(return_value=None)

    with pytest.raises(ValueError, match="unknown mode UNKNOWN_MODE"):
        model_adapter.run("Test prompt")


def test_run_with_guardrails_blocking(model_adapter):
    model_adapter._mode = ChatbotMode.CHAIN.value
    model_adapter.apply_bedrock_guardrails = MagicMock(
        return_value={"content": "Blocked by guardrails"}
    )

    result = model_adapter.run("Test prompt")

    assert result["content"] == "Blocked by guardrails"
    model_adapter.apply_bedrock_guardrails.assert_called_once()


def test_run_with_output_guardrails_blocking(model_adapter):
    model_adapter._mode = ChatbotMode.CHAIN.value
    model_adapter.run_with_chain_v2 = MagicMock(
        return_value={"content": "Test response"}
    )
    model_adapter.apply_bedrock_guardrails = MagicMock(
        side_effect=[None, {"content": "Blocked by guardrails"}]
    )
    model_adapter.chat_history = MagicMock()

    result = model_adapter.run("Test prompt")

    assert result["content"] == "Blocked by guardrails"
    model_adapter.run_with_chain_v2.assert_called_once()
    assert model_adapter.apply_bedrock_guardrails.call_count == 2
    model_adapter.chat_history.replace_last_message.assert_called_once_with(
        "Blocked by guardrails"
    )
