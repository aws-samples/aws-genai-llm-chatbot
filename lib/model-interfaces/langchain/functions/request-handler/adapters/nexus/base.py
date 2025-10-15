"""
Base adapter for Nexus Gateway integration with AWS GenAI LLM Chatbot.
"""

import re
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

    def build_inference_config(
        self,
        temperature: Optional[float] = None,
        top_p: Optional[float] = None,
        max_tokens: Optional[int] = None,
        stop_sequences: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Build inference configuration."""
        config = {
            "temperature": temperature,
            "topP": top_p,
            "maxTokens": max_tokens,
            "stopSequences": stop_sequences,
        }

        return config

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

    def extract_response_content(
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
                            "input_tokens": usage.get("inputTokens", 0),
                            "output_tokens": usage.get("outputTokens", 0),
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
