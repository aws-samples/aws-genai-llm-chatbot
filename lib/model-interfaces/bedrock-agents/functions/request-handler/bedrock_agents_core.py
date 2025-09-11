import os
import re
import json
import uuid
from datetime import datetime
from aws_lambda_powertools import Logger
from botocore.exceptions import ClientError, BotoCoreError
from genai_core.langchain import DynamoDBChatMessageHistory
import genai_core.clients
from genai_core.utils.websocket import send_to_client
from genai_core.types import ChatbotAction

logger = Logger()


def validate_agent_id(agent_id: str) -> bool:
    """Validate agent ID format to prevent injection attacks"""
    if not agent_id or not isinstance(agent_id, str):
        return False

    # Only accept full ARN format
    arn_pattern = (
        r"^arn:aws:bedrock-agentcore:[a-z0-9-]+:\d{12}:runtime/[a-zA-Z0-9_-]+$"
    )
    return bool(re.match(arn_pattern, agent_id))


def get_conversation_history(session_id, user_id, max_messages=20):
    """Get conversation history from DynamoDB with message limit"""
    try:
        logger.info(f"Loading conversation history for session {session_id}")
        chat_history = DynamoDBChatMessageHistory(
            table_name=os.environ["SESSIONS_TABLE_NAME"],
            session_id=session_id,
            user_id=user_id,
        )

        # Get all messages and limit them
        messages = chat_history.messages
        if len(messages) > max_messages:
            # Keep the most recent messages
            recent_messages = messages[-max_messages:]
            logger.info(
                f"Found {len(messages)} total messages, "
                f"using {len(recent_messages)} recent messages"
            )
            messages = recent_messages
        else:
            logger.info(f"Found {len(messages)} messages (within limit)")

        # Convert langchain messages to JSON-serializable format
        history = []
        for msg in messages:
            if hasattr(msg, "type") and hasattr(msg, "content"):
                role = "user" if msg.type == "human" else "assistant"
                history.append({"role": role, "content": msg.content})

        logger.info(f"Converted {len(history)} messages for AgentCore")
        return history

    except Exception as e:
        logger.error(f"Error loading conversation history: {str(e)}")
        return []


def save_session_history(session_id, user_id, prompt, response_content):
    """Save conversation to session history with error recovery"""
    chat_history = None
    try:
        logger.info(f"Saving session history for session {session_id}")
        chat_history = DynamoDBChatMessageHistory(
            table_name=os.environ["SESSIONS_TABLE_NAME"],
            session_id=session_id,
            user_id=user_id,
        )

        # Add user message with metadata
        user_metadata = {
            "provider": "bedrock-agents",
            "sessionId": session_id,
        }
        chat_history.add_user_message(prompt)
        chat_history.add_metadata(user_metadata)

        # Add AI message with metadata
        ai_metadata = {
            "provider": "bedrock-agents",
            "sessionId": session_id,
        }
        chat_history.add_ai_message(response_content)
        chat_history.add_metadata(ai_metadata)

        logger.info("Session history saved successfully")
        return True

    except Exception as e:
        logger.error(f"Error saving session history: {str(e)}")

        # Attempt error recovery
        try:
            if chat_history:
                # Try to save at least the response
                chat_history.add_ai_message(f"Error occurred: {str(e)}")
                chat_history.add_metadata(
                    {
                        "provider": "bedrock-agents",
                        "sessionId": session_id,
                        "error_recovery": True,
                    }
                )
                logger.info("Saved error message to session history")
        except Exception as recovery_error:
            logger.error(f"Error recovery failed: {str(recovery_error)}")

        return False


def create_response_metadata(agent_id, session_id, response=None):
    """Create metadata for agent responses"""
    metadata = {
        "agentRuntimeArn": agent_id,
        "sessionId": session_id,
    }

    if response:
        if "runtimeSessionId" in response:
            metadata["runtimeSessionId"] = response["runtimeSessionId"]
        if "traceId" in response:
            metadata["traceId"] = response["traceId"]
        if "metrics" in response:
            metadata["metrics"] = response["metrics"]

    return metadata


def handle_heartbeat(record):
    """Handle heartbeat requests"""
    user_id = record["userId"]
    session_id = record["data"]["sessionId"]

    send_to_client(
        {
            "type": "text",
            "action": ChatbotAction.HEARTBEAT.value,
            "timestamp": str(int(round(datetime.now().timestamp()))),
            "userId": user_id,
            "data": {
                "sessionId": session_id,
            },
        }
    )


def handle_run(record, context):
    """Main handler function for processing agent requests"""
    user_id = record["userId"]
    user_groups = record["userGroups"]
    data = record["data"]
    agent_id = data["agentRuntimeArn"]
    prompt = data["text"]
    session_id = data.get("sessionId")

    if not session_id:
        session_id = str(uuid.uuid4())

    logger.info(f"Processing agent request: {agent_id} for user {user_id}")

    try:
        # Validate agent ID
        if not validate_agent_id(agent_id):
            error_msg = f"Invalid agent ID format: {agent_id}"
            logger.error(error_msg)
            raise ValueError("Invalid agent ID format")

        # Load conversation history
        conversation_history = get_conversation_history(session_id, user_id)
        logger.info(f"Loaded {len(conversation_history)} messages from history")

        logger.info(f"Using agent runtime ARN: {agent_id}")

        # Send initial thinking step
        send_to_client(
            {
                "type": "text",
                "action": ChatbotAction.THINKING_STEP.value,
                "timestamp": str(int(round(datetime.now().timestamp()))),
                "userId": user_id,
                "data": {
                    "sessionId": session_id,
                    "content": "Starting agent...",
                    "step": "initialization",
                },
            }
        )

        # Add conversation history to the data section
        enhanced_record = record.copy()
        enhanced_record["data"] = {
            **data,
            "conversation_history": conversation_history,
        }
        payload = json.dumps(enhanced_record)

        bedrock_agentcore = genai_core.clients.get_agentcore_client()
        response = bedrock_agentcore.invoke_agent_runtime(
            agentRuntimeArn=agent_id,
            runtimeSessionId=session_id,
            payload=payload,
        )

        # Handle streaming or standard response
        if "text/event-stream" in response.get("contentType", ""):
            # Handle streaming response
            sequence_number = 0
            accumulated_content = ""
            for line in response["response"].iter_lines(chunk_size=10):
                if line:
                    line = line.decode("utf-8")
                    if line.startswith("data: "):
                        line = line[6:]

                    try:
                        # Parse the outer JSON string
                        outer_data = json.loads(line)
                        # Parse the inner data string
                        if isinstance(outer_data, str) and outer_data.startswith(
                            "data: "
                        ):
                            inner_data = outer_data[6:].strip()
                            chunk_data = json.loads(inner_data)
                        else:
                            chunk_data = (
                                outer_data
                                if isinstance(outer_data, dict)
                                else json.loads(outer_data)
                            )

                        # Handle thinking events
                        if chunk_data.get("type") == "thinking":
                            thinking_content = chunk_data.get("content")
                            if thinking_content:
                                send_to_client(
                                    {
                                        "type": "text",
                                        "action": ChatbotAction.THINKING_STEP.value,
                                        "timestamp": str(
                                            int(round(datetime.now().timestamp()))
                                        ),
                                        "userId": user_id,
                                        "data": {
                                            "sessionId": session_id,
                                            "content": thinking_content,
                                            "step": "thinking",
                                        },
                                    }
                                )

                        # Handle content events
                        elif chunk_data.get("type") == "content":
                            chunk_content = chunk_data.get("content")

                            if chunk_content:
                                sequence_number += 1
                                accumulated_content += chunk_content
                                # Send streaming token to client
                                send_to_client(
                                    {
                                        "type": "text",
                                        "action": ChatbotAction.LLM_NEW_TOKEN.value,
                                        "timestamp": str(
                                            int(round(datetime.now().timestamp()))
                                        ),
                                        "userId": user_id,
                                        "data": {
                                            "sessionId": session_id,
                                            "token": {
                                                "runId": session_id,
                                                "sequenceNumber": sequence_number,
                                                "value": chunk_content,
                                            },
                                        },
                                    }
                                )
                    except json.JSONDecodeError:
                        continue

            # Send final response with accumulated content
            logger.info("Sending final response to end streaming")

            # Send done thinking step if we had thinking steps
            if accumulated_content:
                send_to_client(
                    {
                        "type": "text",
                        "action": ChatbotAction.THINKING_STEP.value,
                        "timestamp": str(int(round(datetime.now().timestamp()))),
                        "userId": user_id,
                        "data": {
                            "sessionId": session_id,
                            "content": "Done",
                            "step": "completion",
                        },
                    }
                )

            send_to_client(
                {
                    "type": "text",
                    "action": ChatbotAction.FINAL_RESPONSE.value,
                    "timestamp": str(int(round(datetime.now().timestamp()))),
                    "userId": user_id,
                    "userGroups": user_groups,
                    "direction": "OUT",
                    "data": {
                        "sessionId": session_id,
                        "type": "text",
                        "content": accumulated_content,
                        "metadata": create_response_metadata(
                            agent_id, session_id, response
                        ),
                    },
                }
            )

            # Save session history
            save_session_history(session_id, user_id, prompt, accumulated_content)
        else:
            # Handle standard JSON response
            try:
                if "response" in response:
                    response_body = response["response"].read().decode("utf-8")
                    response_data = json.loads(response_body)

                    if (
                        "result" in response_data
                        and "content" in response_data["result"]
                    ):
                        content_items = response_data["result"]["content"]
                        content = ""
                        for item in content_items:
                            if "text" in item:
                                content += item["text"]
                    else:
                        content = response_body
                else:
                    content = str(response)
            except Exception as e:
                logger.error(f"Error parsing response: {e}")
                content = str(response)

            logger.info(f"Extracted content: {content}")

            send_to_client(
                {
                    "type": "text",
                    "action": ChatbotAction.FINAL_RESPONSE.value,
                    "timestamp": str(int(round(datetime.now().timestamp()))),
                    "userId": user_id,
                    "userGroups": user_groups,
                    "direction": "OUT",
                    "data": {
                        "sessionId": session_id,
                        "content": content,
                        "type": "text",
                        "metadata": create_response_metadata(
                            agent_id, session_id, response
                        ),
                    },
                }
            )

            # Save session history
            save_session_history(session_id, user_id, prompt, content)

        logger.info("Agent request processed successfully")

    except json.JSONDecodeError as e:
        # JSON parsing errors - must come before ValueError
        logger.error(
            f"JSON parsing error for agent {agent_id}: {str(e)}",
            extra={
                "agent_id": agent_id,
                "session_id": session_id,
                "error_type": "json_parse",
            },
        )
        send_to_client(
            {
                "type": "text",
                "action": "error",
                "direction": "OUT",
                "userId": user_id,
                "timestamp": str(int(round(datetime.now().timestamp()))),
                "data": {
                    "sessionId": session_id,
                    "content": "Unable to process response. Please try again.",
                    "type": "text",
                },
            }
        )
    except ValueError as e:
        # Input validation errors
        logger.error(
            f"Input validation error for agent {agent_id}: {str(e)}",
            extra={
                "agent_id": agent_id,
                "session_id": session_id,
                "error_type": "validation",
            },
        )
        send_to_client(
            {
                "type": "text",
                "action": "error",
                "direction": "OUT",
                "userId": user_id,
                "timestamp": str(int(round(datetime.now().timestamp()))),
                "data": {
                    "sessionId": session_id,
                    "content": "Invalid request parameters. Please check your input.",
                    "type": "text",
                },
            }
        )
    except (ClientError, BotoCoreError) as e:
        # AWS service errors - log details but send generic message
        logger.error(
            f"AWS service error invoking agent {agent_id}: {str(e)}",
            extra={
                "agent_id": agent_id,
                "session_id": session_id,
                "error_type": "aws_service",
            },
        )
        send_to_client(
            {
                "type": "text",
                "action": "error",
                "direction": "OUT",
                "userId": user_id,
                "timestamp": str(int(round(datetime.now().timestamp()))),
                "data": {
                    "sessionId": session_id,
                    "content": "Service temporarily unavailable. Please try again.",
                    "type": "text",
                },
            }
        )
    except Exception as e:
        # Catch-all for unexpected errors - log details but send generic message
        logger.error(
            f"Unexpected error invoking agent {agent_id}: {type(e).__name__}",
            extra={
                "agent_id": agent_id,
                "session_id": session_id,
                "error_type": "unexpected",
            },
            exc_info=True,
        )
        send_to_client(
            {
                "type": "text",
                "action": "error",
                "direction": "OUT",
                "userId": user_id,
                "timestamp": str(int(round(datetime.now().timestamp()))),
                "data": {
                    "sessionId": session_id,
                    "content": "An unexpected error occurred. Please try again.",
                    "type": "text",
                },
            }
        )
