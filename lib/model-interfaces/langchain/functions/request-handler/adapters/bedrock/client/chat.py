from typing import Any, AsyncIterator, Dict, Iterator, List, Optional, Mapping


from langchain.callbacks.manager import (
    AsyncCallbackManagerForLLMRun,
    CallbackManagerForLLMRun,
)
from langchain.chat_models.anthropic import convert_messages_to_prompt_anthropic
from langchain.chat_models.base import BaseChatModel
from .base import BedrockBase
from langchain.schema.output import ChatGeneration, ChatGenerationChunk, ChatResult
from langchain.schema.messages import (
    AIMessageChunk,
    AIMessage,
    BaseMessage
)


class ChatPromptAdapter:
    """Adapter class to prepare the inputs from Langchain to prompt format
    that Chat model expects.
    """

    @classmethod
    def convert_messages_to_prompt(
        cls, provider: str, messages: List[BaseMessage]
    ) -> str:
        if provider in ("anthropic", "amazon"):
            prompt = convert_messages_to_prompt_anthropic(messages=messages)
        else:
            raise NotImplementedError(
                f"Provider {provider} model does not support chat."
            )
        return prompt


class BedrockChat(BaseChatModel, BedrockBase):
    @property
    def _llm_type(self) -> str:
        """Return type of chat model."""
        return "amazon_bedrock_chat"

    class Config:
        """Configuration for this pydantic object."""
    
        allow_population_by_field_name = True

    def _stream(
        self,
        messages: List[BaseMessage],
        stop: Optional[List[str]] = None,
        run_manager: Optional[CallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> Iterator[ChatGenerationChunk]:
        for chunk in self._prepare_input_and_invoke_with_streaming(
            prompt=messages[-1].content, stop=stop, run_manager=run_manager, **kwargs):
            finish_reason = chunk.get("finish_reason")
            generation_info = (
                dict(finish_reason=finish_reason) if finish_reason is not None else None
            )
            print("chunk: ", chunk)
            chat_chunk = ChatGenerationChunk(message=AIMessageChunk(content=chunk.get("message"), generation_info=generation_info))
            print("chat_chunk: ", chat_chunk)
            yield chat_chunk
            if run_manager:
                run_manager.on_llm_new_token(chunk.get("message"), chunk=chunk)

    def _astream(
        self,
        messages: List[BaseMessage],
        stop: Optional[List[str]] = None,
        run_manager: Optional[AsyncCallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> AsyncIterator[ChatGenerationChunk]:
        raise NotImplementedError(
            """Bedrock doesn't support async requests at the moment."""
        )

    def _generate(
        self,
        messages: List[BaseMessage],
        stop: Optional[List[str]] = None,
        run_manager: Optional[CallbackManagerForLLMRun] = None,
        stream: Optional[bool] = False,
        **kwargs: Any,
    ) -> ChatResult:
        print(stream)
        print(kwargs)
        should_stream = self.streaming
        provider = self._get_provider()
        print(provider)
        prompt = ChatPromptAdapter.convert_messages_to_prompt(
            provider=provider, messages=messages
        )

        params: Dict[str, Any] = {**kwargs}
        if stop:
            params["stop_sequences"] = stop

        if should_stream:
            generation: Optional[ChatGenerationChunk] = None
            for chunk in self._stream(
                messages=messages, stop=stop, run_manager=run_manager, **kwargs
            ):
                if generation is None:
                    generation = chunk
                else:
                    generation += chunk
            assert generation is not None
            message = AIMessage(content=generation.text)
            return ChatResult(generations=[ChatGeneration(message=message)])

        completion = self._prepare_input_and_invoke(
            prompt=prompt, stop=stop, run_manager=run_manager, **params
        )

        message = AIMessage(content=completion)
        return ChatResult(generations=[ChatGeneration(message=message)])


    async def _agenerate(
        self,
        messages: List[BaseMessage],
        stop: Optional[List[str]] = None,
        run_manager: Optional[AsyncCallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> ChatResult:
        raise NotImplementedError(
            """Bedrock doesn't support async stream requests at the moment."""
        )