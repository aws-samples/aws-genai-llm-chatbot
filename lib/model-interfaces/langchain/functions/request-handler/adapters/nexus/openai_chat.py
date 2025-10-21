"""
EH Gateway Chat Adapter for OpenAI Models.
"""

from typing import Dict, List, Optional, Any
from aws_lambda_powertools import Logger
from genai_core.model_providers.nexus.types import ApiError
from .base import NexusGatewayAdapter

logger = Logger()


class NexusOpenAIChatAdapter(NexusGatewayAdapter):
    """OpenAI chat adapter for EH Gateway integration."""

    def __init__(self, model_id: str, *args, **kwargs):
        logger.info(f"Initializing NexusOpenAIChatAdapter with model_id: {model_id}")
        # Enable streaming in model kwargs
        kwargs.setdefault("model_kwargs", {})["streaming"] = True

        super().__init__(model_id, *args, **kwargs)

    def run(
        self,
        prompt: str,
        workspace_id: Optional[str] = None,
        user_groups: Optional[List[str]] = None,
        images: Optional[List[Dict[str, str]]] = None,
        documents: Optional[List[Dict[str, str]]] = None,
        videos: Optional[List[Dict[str, str]]] = None,
        system_prompts: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """Run streaming chat with Nexus Gateway -
        returns complete response after streaming."""
        try:
            logger.info(
                f"""Processing streaming chat request for model: {self.model_id},
                session: {self.session_id}"""
            )

            # Validate unsupported features
            if images or documents or videos:
                raise ValueError(
                    "NexusOpenAIChatAdapter does not support file attachments yet"
                )
            if workspace_id:
                raise ValueError(
                    """NexusOpenAIChatAdapter does not support
                    workspace/RAG functionality yet"""
                )

            # Get system prompt and conversation history
            system_prompt = None
            if system_prompts:
                system_prompt = system_prompts.get(
                    "system_prompt"
                ) or system_prompts.get("systemPrompt")

            conversation_history = self.get_conversation_history()

            # Build request body
            request_body = self.build_openai_request_body(
                self.model_id, prompt, system_prompt, conversation_history
            )

            # Check if streaming is enabled and supported
            if self.model_kwargs.get("streaming", False) and not self.disable_streaming:
                logger.info("Invoking openai streaming chat endpoint")
                response = self.nexus_client.invoke_openai_stream_chat(
                    body=request_body
                )
                if isinstance(response, ApiError):
                    return {
                        "sessionId": self.session_id,
                        "type": "error",
                        "content": response.message,
                        "metadata": {"sessionId": self.session_id},
                    }

                full_response = self._process_openai_streaming_response(response)
            else:
                logger.info("Invoking openai non-streaming chat endpoint")
                response = self.nexus_client.invoke_openai_chat(body=request_body)
                if isinstance(response, ApiError):
                    return {
                        "sessionId": self.session_id,
                        "type": "error",
                        "content": response.message,
                        "metadata": {"sessionId": self.session_id},
                    }
                full_response = self._extract_openai_chat_response(response)

            # Update chat history and log usage
            self.update_chat_history(prompt, full_response)
            self.log_token_usage(response)

            logger.info(
                f"Successfully processed GenAIEH openai chat request for session: "
                f"{self.session_id}"
            )
            return self.format_response(full_response, user_groups)

        except ValueError:
            # Re-raise validation errors (unsupported features)
            raise
        except Exception as e:
            logger.error(
                f"Error in NexusOpenAIChatAdapter.run: {str(e)}", exc_info=True
            )
            return self.handle_nexus_error(e, "open ai chat processing")

    def _process_openai_streaming_response(self, response: Dict[str, Any]) -> str:
        """Process openai response and return complete text."""
        full_response = ""
        try:
            # stream response back
            if "chunks" in response:
                chunks = response["chunks"]
                for chunk in chunks:
                    token = chunk
                    logger.info("Sending stream events to on_llm_new_token")
                    self.on_llm_new_token(
                        token, run_id=None, chunk=chunk, parent_run_id=None
                    )
                    full_response += token
                return full_response
            else:
                return full_response
        except Exception as e:
            logger.error(f"Error processing openai stream response: {e}")
        return str(response)

    def _extract_openai_chat_response(
        self, response: str | Dict[str, Any] | Any
    ) -> str:
        try:
            import json

            response = json.loads(response) if isinstance(response, str) else response

            if isinstance(response, dict) and "choices" in response:
                if len(response["choices"]) > 0:
                    return response["choices"][0]["message"]["content"]
            return str(response)
        except Exception as e:
            logger.error(f"Error extracting openai chat response: {e}")
        return ""
