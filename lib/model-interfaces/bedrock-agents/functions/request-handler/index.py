import os
import re
import json
import uuid
from datetime import datetime
import boto3
from botocore.exceptions import ClientError, BotoCoreError
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.batch import BatchProcessor, EventType
from aws_lambda_powertools.utilities.batch.exceptions import BatchProcessingError
from aws_lambda_powertools.utilities.data_classes.sqs_event import SQSRecord
from aws_lambda_powertools.utilities.typing import LambdaContext

from genai_core.utils.websocket import send_to_client
from genai_core.types import ChatbotAction
from genai_core.langchain import DynamoDBChatMessageHistory
from genai_core.clients import get_agentcore_client

processor = BatchProcessor(event_type=EventType.SQS)
tracer = Tracer()
logger = Logger()


def check_session_expired(session_id, user_id):
    """Check if AgentCore session has expired based on time limits"""
    try:
        chat_history = DynamoDBChatMessageHistory(
            table_name=os.environ["SESSIONS_TABLE_NAME"],
            session_id=session_id,
            user_id=user_id,
        )

        # Get session metadata from DynamoDB
        session_data = chat_history.table.get_item(
            Key={"SessionId": session_id, "UserId": user_id}
        ).get("Item", {})

        if not session_data:
            return True, []  # New session

        start_time = session_data.get("StartTime")
        last_activity = session_data.get("LastActivity", start_time)

        if not start_time:
            return True, []

        # Parse timestamps
        start_dt = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
        last_dt = datetime.fromisoformat(last_activity.replace("Z", "+00:00"))
        now = datetime.now().replace(tzinfo=start_dt.tzinfo)

        # Check 8-hour limit or 15-minute inactivity
        session_age = (now - start_dt).total_seconds()
        inactivity = (now - last_dt).total_seconds()

        expired = (
            session_age > 8 * 3600 or inactivity > 15 * 60
        )  # 8 hours or 15 minutes

        # Get conversation history if expired
        history = []
        if expired and "History" in session_data:
            # Convert DynamoDB history to AgentCore format
            for msg in session_data["History"]:
                if isinstance(msg, dict) and "type" in msg and "content" in msg:
                    role = "user" if msg["type"] == "human" else "assistant"
                    history.append({"role": role, "content": msg["content"]})

        return expired, history

    except Exception as e:
        logger.error(f"Error checking session expiration: {e}")
        return True, []  # Assume expired on error


def validate_agent_id(agent_id: str) -> bool:
    """Validate agent ID format to prevent injection attacks"""
    if not agent_id or not isinstance(agent_id, str):
        return False
    
    # Allow ARN format or simple agent ID format
    if agent_id.startswith("arn:"):
        # Validate full ARN format
        arn_pattern = r"^arn:aws:bedrock-agentcore:[a-z0-9-]+:\d{12}:runtime/[a-zA-Z0-9_-]+$"
        return bool(re.match(arn_pattern, agent_id))
    else:
        # Validate simple agent ID (alphanumeric, hyphens, underscores only)
        agent_id_pattern = r"^[a-zA-Z0-9_-]+$"
        return bool(re.match(agent_id_pattern, agent_id)) and len(agent_id) <= 100


def get_conversation_history(session_id, user_id, max_messages=20):
    """Get conversation history from DynamoDB with message limit"""
    try:
        logger.info(f"Loading conversation history for session {session_id}")
        chat_history = DynamoDBChatMessageHistory(
            table_name=os.environ["SESSIONS_TABLE_NAME"],
            session_id=session_id,
            user_id=user_id,
        )

        # Get session data from DynamoDB
        session_data = chat_history.table.get_item(
            Key={"SessionId": session_id, "UserId": user_id}
        ).get("Item", {})

        history = []
        if session_data and "History" in session_data:
            messages = session_data["History"]
            # Limit to recent messages for performance
            recent_messages = messages[-max_messages:] if len(messages) > max_messages else messages
            
            logger.info(f"Found {len(messages)} total messages, using {len(recent_messages)} recent messages")
            
            # Convert DynamoDB history to AgentCore format
            for i, msg in enumerate(recent_messages):
                if isinstance(msg, dict) and "type" in msg and "data" in msg:
                    msg_data = msg["data"]
                    if isinstance(msg_data, dict) and "content" in msg_data:
                        role = "user" if msg["type"] == "human" else "assistant"
                        history.append({"role": role, "content": msg_data["content"]})
                else:
                    logger.warning(f"Message {i} has unexpected structure")
            logger.info(f"Converted {len(history)} messages for AgentCore")
        else:
            logger.info("No conversation history found")

        return history

    except Exception as e:
        logger.error(f"Error loading conversation history: {e}", exc_info=True)
        return []


def save_session_history(session_id, user_id, prompt, response_content):
    """Save conversation to session history with error recovery"""
    chat_history = None
    user_message_added = False
    
    try:
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
        user_message_added = True
        chat_history.add_metadata(user_metadata)
        
        # Add AI message with metadata  
        ai_metadata = {
            "provider": "bedrock-agents",
            "sessionId": session_id,
        }
        chat_history.add_ai_message(response_content)
        chat_history.add_metadata(ai_metadata)
        
        logger.info("Session history saved successfully")
        
    except Exception as e:
        logger.error(f"Error saving session history: {e}", exc_info=True)
        
        # Attempt recovery if user message was added but AI message failed
        if user_message_added and chat_history:
            try:
                logger.info("Attempting to recover from partial session save failure")
                # Try to add a placeholder AI message to maintain conversation integrity
                chat_history.add_ai_message("Error processing response. Please try again.")
                chat_history.add_metadata({
                    "provider": "bedrock-agents",
                    "sessionId": session_id,
                    "error_recovery": True,
                })
                logger.info("Recovery message added to maintain session integrity")
            except Exception as recovery_error:
                logger.error(f"Session recovery failed: {recovery_error}", exc_info=True)


def handle_heartbeat(record):
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
    user_id = record["userId"]
    user_groups = record["userGroups"]
    data = record["data"]
    agent_id = data["agentId"]
    prompt = data["text"]
    session_id = data.get("sessionId")

    if not session_id:
        session_id = str(uuid.uuid4())

    try:
        # Load conversation history
        conversation_history = get_conversation_history(session_id, user_id)
        logger.info(f"Loaded {len(conversation_history)} messages from history")

        # Validate agent ID to prevent injection attacks
        if not validate_agent_id(agent_id):
            logger.error(f"Invalid agent ID format: {agent_id}")
            raise ValueError("Invalid agent ID format")

        # Convert agent ID to full ARN format
        if not agent_id.startswith("arn:"):
            region = os.environ.get("AWS_REGION")
            account_id = context.invoked_function_arn.split(":")[4]
            agent_runtime_arn = (
                f"arn:aws:bedrock-agentcore:{region}:{account_id}:runtime/{agent_id}"
            )
        else:
            agent_runtime_arn = agent_id

        logger.info(f"Using agent runtime ARN: {agent_runtime_arn}")

        # Always include conversation history (populated or empty list)
        logger.info(f"Sending {len(conversation_history)} messages in conversation_history")
        # Add conversation history to the data section
        enhanced_record = record.copy()
        enhanced_record["data"] = {
            **data,
            "conversation_history": conversation_history,
        }
        payload = json.dumps(enhanced_record)

        bedrock_agentcore = get_agentcore_client()
        response = bedrock_agentcore.invoke_agent_runtime(
            agentRuntimeArn=agent_runtime_arn,
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
                        if outer_data.startswith("data: "):
                            inner_data = outer_data[6:].strip()
                            chunk_data = json.loads(inner_data)

                            if "event" in chunk_data:
                                chunk_content = chunk_data["event"]

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
                        "metadata": {
                            "agentId": agent_id,
                            "sessionId": session_id,
                            "runtimeSessionId": response.get("runtimeSessionId"),
                            "traceId": response.get("traceId"),
                        },
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

            # Extract metadata from response if available
            metadata = {
                "agentId": agent_id,
                "sessionId": session_id,
            }

            # Add any additional metadata from the agent response
            if "runtimeSessionId" in response:
                metadata["runtimeSessionId"] = response["runtimeSessionId"]
            if "traceId" in response:
                metadata["traceId"] = response["traceId"]
            if "metrics" in response:
                metadata["metrics"] = response["metrics"]

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
                        "metadata": metadata,
                    },
                }
            )

            # Save session history
            save_session_history(session_id, user_id, prompt, content)

    except ValueError as e:
        # Input validation errors
        logger.error(
            f"Input validation error for agent {agent_id}: {str(e)}",
            extra={"agent_id": agent_id, "session_id": session_id, "error_type": "validation"},
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
            extra={"agent_id": agent_id, "session_id": session_id, "error_type": "aws_service"},
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
    except json.JSONDecodeError as e:
        # JSON parsing errors
        logger.error(
            f"JSON parsing error for agent {agent_id}: {str(e)}",
            extra={"agent_id": agent_id, "session_id": session_id, "error_type": "json_parse"},
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
    except Exception as e:
        # Catch-all for unexpected errors - log details but send generic message
        logger.error(
            f"Unexpected error invoking agent {agent_id}: {type(e).__name__}",
            extra={"agent_id": agent_id, "session_id": session_id, "error_type": "unexpected"},
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


@tracer.capture_method
def record_handler(record: SQSRecord, context: LambdaContext):
    payload: str = record.body
    message: dict = json.loads(payload)
    detail: dict = json.loads(message["Message"])
    logger.debug(detail)

    if detail["action"] == ChatbotAction.RUN.value:
        handle_run(detail, context)
    elif detail["action"] == ChatbotAction.HEARTBEAT.value:
        handle_heartbeat(detail)


@logger.inject_lambda_context(log_event=False)
@tracer.capture_lambda_handler
def handler(event, context: LambdaContext):
    batch = event["Records"]

    try:
        with processor(
            records=batch, handler=lambda record: record_handler(record, context)
        ):
            processor.process()
    except BatchProcessingError as e:
        logger.error(e)

    return processor.response()
