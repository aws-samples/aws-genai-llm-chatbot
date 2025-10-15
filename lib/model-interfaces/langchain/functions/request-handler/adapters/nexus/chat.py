"""
Nexus Gateway Chat Adapter for AWS GenAI LLM Chatbot.
"""

from typing import Dict, List, Optional, Any
from aws_lambda_powertools import Logger
from genai_core.model_providers.nexus.types import ApiError
from .base import NexusGatewayAdapter

logger = Logger()


class NexusChatAdapter(NexusGatewayAdapter):
    """Chat adapter for Nexus Gateway integration."""

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
                    "NexusChatAdapter does not support workspace/RAG functionality yet"
                )

            # Get system prompt and conversation history
            system_prompt = None
            if system_prompts:
                system_prompt = system_prompts.get(
                    "system_prompt"
                ) or system_prompts.get("systemPrompt")

            conversation_history = self.get_conversation_history()

            # Build and send request
            request_body = self.build_request_body(
                prompt, system_prompt, conversation_history
            )
            logger.debug(f"Nexus request body: {request_body}")

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

            # Process response
            llm_response = self.extract_response_content(response)
            self.update_chat_history(prompt, llm_response)
            self.log_token_usage(response)

            logger.info(
                f"Successfully processed chat request for session: {self.session_id}"
            )
            return self.format_response(llm_response, user_groups)

        except ValueError:
            # Re-raise ValueError for unsupported features
            raise
        except Exception as e:
            logger.error(f"Error in NexusChatAdapter.run: {str(e)}", exc_info=True)
            return self.handle_nexus_error(e, "chat processing")
