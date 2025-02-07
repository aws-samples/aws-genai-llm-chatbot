import json
import os
import pytest
import base64
from unittest.mock import MagicMock
from genai_core.registry import registry
import adapters.bedrock.base  # noqa: F401 Needed to register the adapters
from genai_core.types import (
    ChatbotMessageType,
    Modality,
    CommonError,
)


def test_registry():
    with pytest.raises(ValueError, match="not found"):
        registry.get_adapter("invalid")
    registry.get_adapter("bedrock.amazon.nova-canvas-test")
    registry.get_adapter("bedrock.amazon.nova-reel-test")


@pytest.fixture
def mock_bedrock_setup(mocker):
    mock_bedrock_client = MagicMock()
    mocker.patch("aws_lambda_powertools.Logger.info", return_value=None)
    mocker.patch(
        "genai_core.clients.get_bedrock_client", return_value=mock_bedrock_client
    )
    adapter = registry.get_adapter("bedrock.amazon.nova-canvas.test")
    model = adapter(
        model_id="model",
        mode="mode",
        session_id="session",
        user_id="user",
        model_kwargs={},
    )
    return model, mock_bedrock_client


def test_generate_image(mock_bedrock_setup, mocker):
    model, mock_bedrock_client = mock_bedrock_setup
    model.client = mock_bedrock_client
    mock_encoded_image = base64.b64encode(b"dummy_image_bytes").decode("utf-8")

    model.client.invoke_model.return_value = {
        "ResponseMetadata": {"RequestId": "test-id"},
        "body": mocker.Mock(read=lambda: json.dumps({"images": [mock_encoded_image]})),
    }

    mocker.patch.object(
        model,
        "get_file_from_s3",
        return_value={"source": {"bytes": b"test"}, "format": "jpg"},
    )
    mocker.patch.object(
        model, "upload_file_message", return_value={"key": "test.jpg", "type": "image"}
    )

    result = model.generate_image(
        {"last_message": "Generate an image"}, [{"type": Modality.IMAGE.value}]
    )

    assert len(result["images"]) == 1
    assert result["images"][0]["key"] == "test.jpg"
    assert result["images"][0]["type"] == "image"


def test_generate_video(mock_bedrock_setup, mocker):
    model, mock_bedrock_client = mock_bedrock_setup
    model.client = mock_bedrock_client
    model.client.start_async_invoke.return_value = {
        "invocationArn": "arn:aws:bedrock:us-XXXX-X:XXXXX:inference-execution/test-model/test-id"  # noqa
    }

    mocker.patch.object(
        model,
        "get_file_from_s3",
        return_value={"source": {"bytes": b"test"}, "format": "jpg"},
    )

    mocker.patch.dict("os.environ", {"CHATBOT_FILES_BUCKET_NAME": "test-bucket"})

    result = model.generate_video(
        {"last_message": "Generate a video"},
        [{"key": "mock_file", "type": Modality.IMAGE.value}],
    )

    assert len(result["videos"]) == 1
    assert result["videos"][0]["key"] == "test-id/output.mp4"
    assert result["videos"][0]["type"] == Modality.VIDEO.value


def test_adapter_streaming_disabled(mock_bedrock_setup):
    model, _ = mock_bedrock_setup
    assert model.disable_streaming == True
    os.environ["BEDROCK_GUARDRAILS_ID"] = "AnId"
    assert model.should_call_apply_bedrock_guardrails() == True
    del os.environ["BEDROCK_GUARDRAILS_ID"]
    assert model.should_call_apply_bedrock_guardrails() == False


def test_format_prompt(mock_bedrock_setup, mocker):
    model, _ = mock_bedrock_setup
    messages = [
        MagicMock(
            type=ChatbotMessageType.Human.value,
            content="Hello",
            additional_kwargs={"files": [{"type": Modality.IMAGE.value}]},
        ),
        MagicMock(type=ChatbotMessageType.AI.value, content="Hi there"),
    ]
    files = [{"type": Modality.VIDEO.value}]

    mocker.patch.object(
        model,
        "get_file_from_s3",
        return_value={"type": "video", "source": "mocked_file"},
    )
    result = model.format_prompt("How are you?", messages, files)
    assert len(result["messages"]) == 3
    assert result["last_message"] == "How are you?"


def test_guess_extension_from_bytes(mock_bedrock_setup, mocker):
    model, _ = mock_bedrock_setup

    mocker.patch("filetype.guess", return_value=MagicMock(extension="jpg"))
    mocker.patch("mimetypes.guess_extension", return_value=".jpg")
    result = model.guess_extension_from_bytes(b"dummy_image_bytes")

    assert result == ".jpg"


def test_get_llm_error(mock_bedrock_setup, mocker):
    model, _ = mock_bedrock_setup

    mocker.patch("genai_core.clients.get_bedrock_client", return_value=None)

    with pytest.raises(ValueError, match="Bedrock client is not initialized"):
        model.get_llm()


def test_generate_image_error(mock_bedrock_setup, mocker):
    model, mock_bedrock_client = mock_bedrock_setup
    model.client = mock_bedrock_client
    model.client.invoke_model.return_value = {
        "ResponseMetadata": {"RequestId": "test-id"},
        "body": mocker.Mock(
            read=lambda: json.dumps({"error": "Test error", "images": []})
        ),
    }
    with pytest.raises(CommonError, match="Error occured generating image"):
        model.generate_image({"last_message": "Generate an image"}, [])
