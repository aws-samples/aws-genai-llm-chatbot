"""
Base adapter for Nexus Gateway integration with AWS GenAI LLM Chatbot.
"""

import re
from abc import abstractmethod
from typing import Dict, List, Optional, Any, Union
from datetime import datetime
from aws_lambda_powertools import Logger
from adapters.base import ModelAdapter
from genai_core.model_providers.nexus.nexus_client import get_nexus_gateway_client
from genai_core.model_providers.nexus.types import ApiError

logger = Logger()


class NexusGatewayAdapter(ModelAdapter):
    """Base adapter for Nexus Gateway integration."""

    def __init__(self, model_id: str, *args, **kwargs):
        self.model_id = model_id
        super().__init__(*args, **kwargs)
        self._nexus_client = None

    @property
    def nexus_client(self):
        """Lazy initialization of Nexus Gateway client."""
        if self._nexus_client is None:
            self._nexus_client = get_nexus_gateway_client()
            if self._nexus_client is None:
                raise ValueError("Nexus Gateway client is not configured")
        return self._nexus_client

    @abstractmethod
    def on_llm_new_token(
        self, token, run_id=None, chunk=None, parent_run_id=None, *args, **kwargs
    ) -> None: ...

    def get_llm(
        self, model_kwargs: Dict[str, Any] = None, extra: Dict[str, Any] = None
    ):
        """Not used for Nexus Gateway - uses direct API calls."""
        return None

    def build_message_body(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        history: Optional[List[Dict[str, str]]] = None,
    ) -> Dict[str, Any]:
        """Build message body for Bedrock Converse API."""
        messages = []

        # Add conversation history
        if history:
            for message in history:
                if (
                    isinstance(message, dict)
                    and "role" in message
                    and "content" in message
                ):
                    content = message["content"]
                    if isinstance(content, str):
                        content = [{"text": content}]
                    messages.append({"role": message["role"], "content": content})

        # Add current user message
        messages.append({"role": "user", "content": [{"text": prompt}]})

        message_body = {"messages": messages}
        if system_prompt:
            message_body["system"] = [{"text": system_prompt}]

        return message_body

    def build_openai_message_body(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        history: Optional[List[Dict[str, str]]] = None,
    ) -> Dict[str, Any]:
        """Build message body for OpenAI Chat API."""
        messages = []

        # Add system prompt
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})

        # Add conversation history - convert from Bedrock format if needed
        if history:
            converted_history = self.convert_bedrock_to_openai_format(history)
            messages.extend(converted_history)

        # Add current user message
        messages.append({"role": "user", "content": prompt})

        return {"messages": messages}

    def build_inference_config(
        self,
        provider: str = "bedrock",
        temperature: Optional[float] = None,
        top_p: Optional[float] = None,
        max_tokens: Optional[int] = None,
        stop_sequences: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Build inference configuration for specified provider."""
        config = {
            "temperature": temperature or self.model_kwargs.get("temperature", None),
        }

        max_tokens = max_tokens or self.model_kwargs.get("maxTokens", None)
        top_p = top_p or self.model_kwargs.get("topP", None)
        stop_sequences = stop_sequences or self.model_kwargs.get("stopSequences", None)

        if provider == "openai":
            config.update(
                {
                    "top_p": top_p,
                    "max_completion_tokens": max_tokens,
                }
            )
        else:
            config.update(
                {
                    "topP": top_p,
                    "maxTokens": max_tokens,
                    "stopSequences": stop_sequences,
                }
            )

        return config

    def convert_bedrock_to_openai_format(
        self, history: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Convert Bedrock format messages to OpenAI format."""
        converted_history = []

        for message in history:
            if isinstance(message, dict) and "role" in message and "content" in message:
                role = message["role"]
                content = message["content"]

                # Convert Bedrock nested content format to OpenAI string format
                if isinstance(content, list) and len(content) > 0:
                    if isinstance(content[0], dict) and "text" in content[0]:
                        content = content[0]["text"]
                    else:
                        content = str(content[0])
                elif not isinstance(content, str):
                    content = str(content)

                converted_history.append({"role": role, "content": content})

        return converted_history

    def get_conversation_history(self) -> List[Dict[str, Any]]:
        """Get existing conversation history formatted for Nexus Gateway."""
        history = []

        try:
            if hasattr(self.chat_history, "messages") and self.chat_history.messages:
                for message in self.chat_history.messages:
                    if hasattr(message, "type") and hasattr(message, "content"):
                        role = "user" if message.type == "human" else "assistant"
                        content = message.content
                        if isinstance(content, str):
                            content = [{"text": content}]
                        history.append({"role": role, "content": content})

            logger.debug(f"Retrieved {len(history)} messages from chat history")
        except Exception as e:
            logger.warning(f"Error retrieving chat history: {str(e)}")
            history = []

        return history

    def update_chat_history(self, user_message: str, ai_response: str) -> None:
        """Update chat history with current conversation turn."""
        try:
            self.chat_history.add_user_message(user_message)
            self.chat_history.add_ai_message(ai_response)

            if hasattr(self.chat_history, "add_metadata"):
                metadata = {
                    "modelId": self.model_id,
                    "sessionId": self.session_id,
                    "userId": self.user_id,
                    "timestamp": datetime.utcnow().isoformat() + "Z",
                }
                self.chat_history.add_metadata(metadata)
        except Exception as e:
            logger.error(f"Error updating chat history: {str(e)}")

    def extract_bedrock_response_content(
        self, response: Union[Dict[str, Any], ApiError]
    ) -> str:
        """Extract text content from Nexus Gateway response."""
        if isinstance(response, ApiError):
            raise ValueError(
                f"Nexus Gateway API error: {response.error_type} - {response.message}"
            )

        # Handle Bedrock Converse response format
        if "output" in response and "message" in response["output"]:
            content_list = response["output"]["message"].get("content", [])
            if (
                content_list
                and isinstance(content_list[0], dict)
                and "text" in content_list[0]
            ):
                return content_list[0]["text"]

        # Fallback formats
        if "content" in response:
            return str(response["content"])
        if "message" in response:
            return str(response["message"])

        logger.warning(f"Unexpected response format: {response}")
        return str(response)

    def log_token_usage(self, response: Dict[str, Any]) -> None:
        """Log token usage metrics if available."""
        try:
            usage = response.get("usage") or response.get("metadata", {}).get("usage")
            if not usage:
                return

            total_tokens = usage.get("totalTokens") or usage.get("total_tokens")
            if total_tokens:
                logger.info(
                    "Usage Metric",
                    model=self.model_id,
                    metric_type="token_usage",
                    value=total_tokens,
                    session_id=self.session_id,
                )

                if hasattr(self, "callback_handler") and self.callback_handler:
                    if not hasattr(self.callback_handler, "usage"):
                        self.callback_handler.usage = {}
                    self.callback_handler.usage.update(
                        {
                            "total_tokens": total_tokens,
                            "input_tokens": usage.get("inputTokens")
                            or usage.get("prompt_tokens")
                            or 0,
                            "output_tokens": usage.get("outputTokens")
                            or usage.get("completion_tokens")
                            or 0,
                        }
                    )
        except Exception as e:
            logger.warning(f"Failed to log token usage: {str(e)}")

    def build_request_body(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        history: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """Build complete request body for Nexus Gateway."""
        message_body = self.build_message_body(prompt, system_prompt, history)
        inference_config = self.build_inference_config()

        body = {
            "messages": message_body["messages"],
            "inferenceConfig": inference_config,
        }

        if "system" in message_body:
            body["system"] = message_body["system"]

        return body

    def build_openai_request_body(
        self,
        model_id: str,
        prompt: str,
        system_prompt: Optional[str] = None,
        history: Optional[List[Dict[str, Any]]] = None,
    ):
        """Build request body for Nexus OpenAI Chat API."""
        message_body = self.build_openai_message_body(prompt, system_prompt, history)
        inference_config = self.build_inference_config(provider="openai")

        return {
            "model": model_id,
            "messages": message_body["messages"],
            "stream": self.model_kwargs.get("streaming", False)
            and not self.disable_streaming,
            **inference_config,
        }

    def format_response(
        self,
        llm_response: str,
        user_groups: Optional[List[str]] = None,
        additional_metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Format final response with metadata."""
        clean_prompts = []
        if hasattr(self, "callback_handler") and hasattr(
            self.callback_handler, "prompts"
        ):
            for prompt in self.callback_handler.prompts:
                clean_prompts.append(re.sub(r"\[{.*}\]*", "*FILE*", prompt))

        metadata = {
            "modelId": self.model_id,
            "modelKwargs": self.model_kwargs,
            "mode": self._mode,
            "sessionId": self.session_id,
            "userId": self.user_id,
            "prompts": clean_prompts,
        }

        if additional_metadata:
            metadata.update(additional_metadata)

        response = {
            "sessionId": self.session_id,
            "type": "text",
            "content": llm_response,
        }

        if is_admin_role(user_groups):
            response["metadata"] = metadata
        else:
            response["metadata"] = {"sessionId": self.session_id}

        return response

    def handle_nexus_error(self, error: Exception, context: str = "") -> Dict[str, Any]:
        """Handle Nexus Gateway errors."""
        error_msg = (
            f"Nexus Gateway error in {context}: {str(error)}"
            if context
            else f"Nexus Gateway error: {str(error)}"
        )
        logger.error(error_msg, exc_info=True)

        return {
            "sessionId": self.session_id,
            "type": "error",
            "content": """I apologize, but I encountered an error
            while processing your request. Please try again.""",
            "metadata": {
                "sessionId": self.session_id,
                "error": error_msg,
            },
        }


def is_admin_role(user_groups: Optional[List[str]]) -> bool:
    """Check if user has admin privileges."""
    if not user_groups:
        return False
    return bool({"admin", "workspace_manager"} & set(user_groups))
