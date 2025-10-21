"""
Nexus Gateway Streaming Chat Adapter for AWS GenAI LLM Chatbot.
"""

from typing import Dict, List, Optional, Any
from aws_lambda_powertools import Logger
from genai_core.model_providers.nexus.types import ApiError
from .base import NexusGatewayAdapter

logger = Logger()


class NexusChatAdapter(NexusGatewayAdapter):
    """
    Chat adapter for Nexus Gateway integration
    handles streaming and non streaming models
    """

    def __init__(self, model_id: str, *args, **kwargs):
        logger.info(f"Initializing NexusChatAdapter with model_id: {model_id}")

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
        """Run chat with Nexus Gateway - returns complete chat response."""
        try:
            logger.info(
                f"""Processing chat request for model: {self.model_id},
                session: {self.session_id}"""
            )

            # Validate unsupported features
            if images or documents or videos:
                raise ValueError(
                    "NexusChatAdapter does not support file attachments yet"
                )
            if workspace_id:
                raise ValueError(
                    """NexusChatAdapter does not support
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
            request_body = self.build_request_body(
                prompt, system_prompt, conversation_history
            )

            # Check if streaming is enabled and supported
            if self.model_kwargs.get("streaming", False) and not self.disable_streaming:
                # Use streaming
                logger.info("Invoking GenAIEH bedrock streaming endpoint")
                response = self.nexus_client.invoke_bedrock_converse_stream(
                    model_id=self.model_id, body=request_body
                )
                if isinstance(response, ApiError):
                    return {
                        "sessionId": self.session_id,
                        "type": "error",
                        "content": response.message,
                        "metadata": {"sessionId": self.session_id},
                    }

                # Process streaming response (this would be handled by the framework)
                full_response = self._process_streaming_response(response)
            else:
                # Fall back to non-streaming
                logger.info("Invoking GenAIEH bedrock non-streaming endpoint")
                response = self.nexus_client.invoke_bedrock_converse(
                    model_id=self.model_id, body=request_body
                )
                if isinstance(response, ApiError):
                    return {
                        "sessionId": self.session_id,
                        "type": "error",
                        "content": response.message,
                        "metadata": {"sessionId": self.session_id},
                    }

                full_response = self.extract_bedrock_response_content(response)

            # Update chat history and log usage
            self.update_chat_history(prompt, full_response)
            self.log_token_usage(response)

            logger.info(
                f"Successfully processed GenAIEH bedrock chat request for session: "
                f"{self.session_id}"
            )
            return self.format_response(full_response, user_groups)

        except ValueError:
            # Re-raise validation errors (unsupported features)
            raise
        except Exception as e:
            logger.error(f"Error in NexusChatAdapter.run: {str(e)}", exc_info=True)
            return self.handle_nexus_error(e, "streaming chat processing")

    def _process_streaming_response(self, response: Dict[str, Any]) -> str:
        """Process streaming response and return complete text."""
        full_response = ""

        # Handle Nexus Gateway streaming response
        if "stream" in response:
            stream_resp = response["stream"]
            try:
                # Handle mock response (list of chunks)
                if isinstance(stream_resp, list):
                    for chunk in stream_resp:
                        if "contentBlockDelta" in chunk:
                            delta = chunk["contentBlockDelta"]
                            if "delta" in delta and "text" in delta["delta"]:
                                token = delta["delta"]["text"]
                                self.on_llm_new_token(
                                    token, run_id=None, chunk=chunk, parent_run_id=None
                                )
                                full_response += token
                    return full_response

                # Handle real response with content attribute
                import json

                content = stream_resp.content
                if content:
                    content_str = content.decode("utf-8", errors="ignore")

                    # Split by contentBlockDelta to find JSON chunks
                    parts = content_str.split("contentBlockDelta")
                    for part in parts[1:]:  # Skip first empty part
                        # Find JSON object in this part
                        json_start = part.find('{"contentBlockIndex"')
                        if json_start >= 0:
                            # Find the end of the JSON object
                            brace_count = 0
                            json_end = json_start
                            for i, char in enumerate(part[json_start:], json_start):
                                if char == "{":
                                    brace_count += 1
                                elif char == "}":
                                    brace_count -= 1
                                    if brace_count == 0:
                                        json_end = i + 1
                                        break

                            try:
                                logger.info("Sending stream events to on_llm_new_token")
                                json_str = part[json_start:json_end]
                                data = json.loads(json_str)
                                if "delta" in data and "text" in data["delta"]:
                                    token = data["delta"]["text"]
                                    # Call token callback for real-time streaming
                                    self.on_llm_new_token(
                                        token,
                                        run_id=None,
                                        chunk=data,
                                        parent_run_id=None,
                                    )
                                    full_response += token
                            except json.JSONDecodeError:
                                continue

            except Exception as e:
                logger.warning(f"Error processing streaming response: {e}")
                full_response = ""
        elif "output" in response:
            # Fallback to non-streaming format
            full_response = self.extract_bedrock_response_content(response)
        else:
            full_response = str(response)

        return full_response
