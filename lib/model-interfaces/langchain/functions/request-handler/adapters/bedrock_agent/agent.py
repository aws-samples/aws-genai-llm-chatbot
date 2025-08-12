import os
import json
import base64
from decimal import Decimal
from typing import Any, Dict, List, Optional

from aws_lambda_powertools import Logger
from genai_core.bedrock_agent import invoke_agent
from genai_core.types import ChatbotMessageType
from adapters.base import ModelAdapter, Mode

logger = Logger()

# Helper function to convert float values to Decimal and handle binary data for DynamoDB
def json_dumps_decimal(obj):
    if isinstance(obj, float):
        return Decimal(str(obj))
    elif isinstance(obj, bytes):
        return base64.b64encode(obj).decode('utf-8')
    elif isinstance(obj, dict):
        return {k: json_dumps_decimal(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [json_dumps_decimal(i) for i in obj]
    else:
        return obj

# Custom JSON encoder to handle bytes and other non-serializable types
class CustomJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, bytes):
            return base64.b64encode(obj).decode('utf-8')
        elif isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)


class BedrockAgentAdapter(ModelAdapter):
    """Adapter for Amazon Bedrock Agent"""
    
    def __init__(
        self,
        model_id: str,
        mode: Optional[str] = None,
        session_id: Optional[str] = None,
        user_id: Optional[str] = None,
        model_kwargs: Dict[str, Any] = {},
        **kwargs,
    ):
        self.model_id = model_id
        super().__init__(
            session_id=session_id,
            user_id=user_id,
            mode=mode,
            model_kwargs=model_kwargs,
            **kwargs,
        )
        # Agent doesn't support streaming
        self.disable_streaming = True
        
    def get_llm(self, model_kwargs={}, extra={}):
        """
        Not used for Bedrock Agent, but required by the ModelAdapter
        """
        return None
        
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
        """Run the agent with the given prompt"""
        try:
            # Add the prompt to the chat history
            self.chat_history.add_user_message(prompt)
            
            # Invoke the agent
            response = invoke_agent(
                session_id=self.session_id,
                prompt=prompt,
                enable_trace=True
            )
            
            # Extract the completion text
            completion = response.get("completion", "")
            
            # Convert any float values in the trace to Decimal for DynamoDB compatibility
            trace = json_dumps_decimal(response.get("trace", {}))
            
            # Add the agent's response to the chat history
            # We need to manually add the message to DynamoDB to handle float values
            from langchain_core.messages import AIMessage
            from langchain.schema import messages_to_dict, _message_to_dict
            import json
            from datetime import datetime
            
            # Get existing messages
            messages = messages_to_dict(self.chat_history.get_messages_from_storage())
            
            # Create and add the AI message
            ai_message = AIMessage(content=completion)
            _message = _message_to_dict(ai_message)
            messages.append(_message)
            
            # Save to DynamoDB with proper float handling
            try:
                # Convert all floats to Decimal and handle binary data for DynamoDB compatibility
                messages_json = json.dumps(messages, cls=CustomJSONEncoder)
                messages_with_decimal = json.loads(messages_json, parse_float=Decimal)
                
                self.chat_history.table.put_item(
                    Item={
                        "SessionId": self.session_id,
                        "UserId": self.user_id,
                        "StartTime": datetime.now().isoformat(),
                        "History": messages_with_decimal,
                    }
                )
            except Exception as err:
                logger.exception(f"Error saving message to DynamoDB: {err}")
            
            # Create metadata for the response
            metadata = json_dumps_decimal({
                "modelId": self.model_id,
                "modelKwargs": self.model_kwargs,
                "mode": self._mode,
                "sessionId": self.session_id,
                "userId": self.user_id,
                "documents": [],
                "trace": trace,
            })
            
            # Add metadata to the chat history if the user is an admin
            if user_groups and ("admin" in user_groups or "workspace_manager" in user_groups):
                # We need to manually add the metadata to avoid float issues
                try:
                    # Get the latest messages again (including our newly added AI message)
                    messages = messages_to_dict(self.chat_history.get_messages_from_storage())
                    if messages:
                        # Add metadata to the last message
                        messages[-1]["data"]["additional_kwargs"] = metadata
                        
                        # Save to DynamoDB with proper float handling
                        messages_json = json.dumps(messages, cls=CustomJSONEncoder)
                        messages_with_decimal = json.loads(messages_json, parse_float=Decimal)
                        
                        self.chat_history.table.put_item(
                            Item={
                                "SessionId": self.session_id,
                                "UserId": self.user_id,
                                "StartTime": datetime.now().isoformat(),
                                "History": messages_with_decimal,
                            }
                        )
                except Exception as err:
                    logger.exception(f"Error adding metadata to DynamoDB: {err}")
            
            # Return the response in the expected format
            # Convert to a regular dictionary instead of using json_dumps_decimal
            response = {
                "sessionId": self.session_id,
                "type": ChatbotMessageType.AI.value,
                "content": completion,
                "metadata": metadata if user_groups and ("admin" in user_groups or "workspace_manager" in user_groups) else {
                    "sessionId": self.session_id,
                },
            }
            
            return response
            
        except Exception as e:
            logger.exception("Error invoking Bedrock Agent")
            raise e
