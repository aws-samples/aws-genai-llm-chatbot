import os
import json
import uuid
from datetime import datetime
import boto3
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.batch import BatchProcessor, EventType
from aws_lambda_powertools.utilities.batch.exceptions import BatchProcessingError
from aws_lambda_powertools.utilities.data_classes.sqs_event import SQSRecord
from aws_lambda_powertools.utilities.typing import LambdaContext

from genai_core.utils.websocket import send_to_client
from genai_core.types import ChatbotAction

processor = BatchProcessor(event_type=EventType.SQS)
tracer = Tracer()
logger = Logger()

bedrock_agentcore = boto3.client("bedrock-agentcore")


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
    session_id = data.get("sessionId")

    if not session_id:
        session_id = str(uuid.uuid4())

    try:
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

        payload = json.dumps(record)

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
                                            "timestamp": str(int(round(datetime.now().timestamp()))),
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
        else:
            # Handle standard JSON response
            try:
                if "response" in response:
                    response_body = response["response"].read().decode("utf-8")
                    response_data = json.loads(response_body)

                    if "result" in response_data and "content" in response_data["result"]:
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
            if 'runtimeSessionId' in response:
                metadata["runtimeSessionId"] = response["runtimeSessionId"]
            if 'traceId' in response:
                metadata["traceId"] = response["traceId"]
            if 'metrics' in response:
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

    except Exception as e:
        logger.error(
            f"Error invoking agent {agent_id}: {str(e)}",
            extra={"agent_id": agent_id, "session_id": session_id},
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
                    "content": "Error invoking agent",
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
            processed_messages = processor.process()
    except BatchProcessingError as e:
        logger.error(e)

    return processor.response()
