import os
from unittest.mock import ANY
import pytest
from genai_core.registry import registry
import adapters.bedrock.base  # noqa: F401 Needed to register the adapters
from langchain_core.messages.human import HumanMessage


def test_registry():
    with pytest.raises(ValueError, match="not found"):
        registry.get_adapter("invalid")
    registry.get_adapter("bedrock.ai21.jamba-test")
    registry.get_adapter("bedrock.cohere.command-text.test")
    registry.get_adapter("bedrock.cohere.command-r.test")
    registry.get_adapter("bedrock.anthropic.claude-test")
    registry.get_adapter("bedrock.meta.llama2")
    registry.get_adapter("bedrock.mistral.mistral-large-test")
    registry.get_adapter("bedrock.mistral.mistral-small-test")
    registry.get_adapter("bedrock.mistral.mistral-7b-test")
    registry.get_adapter("bedrock.mistral.mixtral-test")
    registry.get_adapter("bedrock.amazon.titan-test")


def test_chat_adapter(mocker):
    mocker.patch("aws_lambda_powertools.Logger.info", return_value=None)
    mocker.patch("genai_core.clients.get_bedrock_client", return_value=None)
    adapter = registry.get_adapter("bedrock.ai21.jamba-test")
    model = adapter(
        model_id="model",
        mode="mode",
        session_id="session",
        user_id="user",
        model_kwargs={},
    )
    result = model.get_qa_prompt().format(
        input="input", context="context", chat_history=[HumanMessage(content="history")]
    )
    assert "System: Use the following pieces" in result
    assert "Human: history" in result
    assert "Human: input" in result

    result = model.get_prompt().format(
        input="input", chat_history=[HumanMessage(content="history")]
    )
    assert "System: The following is a friendly conversation" in result
    assert "Human: history" in result
    assert "Human: input" in result

    result = model.get_condense_question_prompt().format(
        input="input", chat_history=[HumanMessage(content="history")]
    )
    assert "System: Given the following conversation" in result
    assert "Human: history" in result
    assert "Human: input" in result

    os.environ["BEDROCK_GUARDRAILS_ID"] = "AnId"
    mock = mocker.patch("langchain_aws.ChatBedrockConverse.__init__", return_value=None)
    result = model.get_llm(
        {"temperature": 0.5, "topP": 5, "maxTokens": 50}, {"extra": "extra"}
    )
    mock.assert_called_once_with(
        client=None,
        disable_streaming=True,
        guardrails={"guardrailIdentifier": "AnId", "guardrailVersion": "DRAFT"},
        max_tokens=50,
        model="model",
        temperature=0.5,
        top_p=5,
        extra="extra",
        callbacks=ANY,
    )


def test_chat_without_system_adapter(mocker):
    mocker.patch("aws_lambda_powertools.Logger.info", return_value=None)
    mocker.patch("genai_core.clients.get_bedrock_client", return_value=None)
    adapter = registry.get_adapter("bedrock.cohere.command-text.test")
    model = adapter(
        model_id="model",
        mode="mode",
        session_id="session",
        user_id="user",
        model_kwargs={},
    )
    result = model.get_qa_prompt().format(
        input="input", context="context", chat_history=[HumanMessage(content="history")]
    )
    assert "Use the following pieces of context" in result
    assert "Question: input" in result
    assert "Helpful Answer:" in result
    assert "context" in result

    result = model.get_prompt().format(
        input="input", chat_history=[HumanMessage(content="history")]
    )
    assert "The following is a friendly conversation" in result
    assert "Current conversation:" in result
    assert "Human: history" in result
    assert "Question: input" in result

    result = model.get_condense_question_prompt().format(
        input="input", chat_history=[HumanMessage(content="history")]
    )
    assert "Given the following conversation" in result
    assert "Chat History:" in result
    assert "Human: history" in result
    assert "Follow Up Input: input" in result

    del os.environ["BEDROCK_GUARDRAILS_ID"]
    mock = mocker.patch("langchain_aws.ChatBedrockConverse.__init__", return_value=None)
    result = model.get_llm({"streaming": True})
    mock.assert_called_once_with(
        client=None,
        disable_streaming=False,
        model="model",
        callbacks=ANY,
    )
