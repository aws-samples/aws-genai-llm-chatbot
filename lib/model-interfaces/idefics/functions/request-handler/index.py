import json
import os
import uuid
from datetime import datetime

import adapters  # noqa: F401 Needed to register the adapters
import boto3
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.batch import BatchProcessor, EventType
from aws_lambda_powertools.utilities.batch.exceptions import BatchProcessingError
from aws_lambda_powertools.utilities.data_classes.sqs_event import SQSRecord
from aws_lambda_powertools.utilities.typing import LambdaContext
from genai_core.langchain import DynamoDBChatMessageHistory
from genai_core.registry import registry
from genai_core.types import ChatbotAction
from genai_core.utils.websocket import send_to_client

print(boto3.__version__)

processor = BatchProcessor(event_type=EventType.SQS)
tracer = Tracer()
logger = Logger()

sequence_number = 0


def on_llm_new_token(user_id, session_id, self, *args, **kwargs):
    chunk = args[0]
    if chunk is None or len(chunk) == 0:
        return
    global sequence_number
    sequence_number += 1

    send_to_client(
        {
            "type": "text",
            "action": ChatbotAction.LLM_NEW_TOKEN.value,
            "userId": user_id,
            "timestamp": str(int(round(datetime.now().timestamp()))),
            "data": {
                "sessionId": session_id,
                "token": {
                    "sequenceNumber": sequence_number,
                    "value": chunk,
                },
            },
        }
    )


def handle_run(record):
    logger.info("Incoming request", record=record)
    user_id = record["userId"]
    user_groups = record["userGroups"]
    data = record["data"]
    provider = data["provider"]
    model_id = data["modelName"]
    mode = data["mode"]
    model_kwargs = data.get("modelKwargs", {})
    prompt = data["text"]
    session_id = data.get("sessionId")
    files = data.get("images", [])

    if not files:
        files = []

    if not session_id:
        session_id = str(uuid.uuid4())

    chat_history = DynamoDBChatMessageHistory(
        table_name=os.environ["SESSIONS_TABLE_NAME"],
        session_id=session_id,
        user_id=user_id,
    )

    messages = chat_history.messages

    adapter = registry.get_adapter(f"{provider}.{model_id}")
    adapter.on_llm_new_token = lambda *args, **kwargs: on_llm_new_token(
        user_id, session_id, *args, **kwargs
    )
    model = adapter(
        model_id=model_id,
        session_id=session_id,
        user_id=user_id,
        model_kwargs=model_kwargs,
        mode=mode,
    )

    run_input = model.format_prompt(
        prompt=prompt,
        messages=messages,
        files=files,
    )

    ai_response = model.handle_run(
        input=run_input, model_kwargs=model_kwargs, files=files
    )

    # Add user files and mesage to chat history
    user_message_metadata = {
        "provider": provider,
        "modelId": model_id,
        "modelKwargs": model_kwargs,
        "mode": mode,
        "sessionId": session_id,
        "userId": user_id,
        "prompts": [model.clean_prompt(run_input)],
        "files": files or [],
    }
    chat_history.add_user_message(prompt)
    chat_history.add_metadata(user_message_metadata)

    # Add AI files and message to chat history
    ai_response_metadata = {
        "provider": provider,
        "modelId": model_id,
        "modelKwargs": model_kwargs,
        "mode": mode,
        "sessionId": session_id,
        "userId": user_id,
        "prompts": [model.clean_prompt(run_input)],
        "files": ai_response.get("files", []),
    }
    ai_text_response = ai_response.get("content", "")
    chat_history.add_ai_message(ai_text_response)
    chat_history.add_metadata(ai_response_metadata)

    response = {
        "sessionId": session_id,
        "type": "text",
        "content": ai_text_response,
        "metadata": ai_response_metadata,
    }

    send_to_client(
        {
            "type": "text",
            "action": ChatbotAction.FINAL_RESPONSE.value,
            "timestamp": str(int(round(datetime.now().timestamp()))),
            "userId": user_id,
            "userGroups": user_groups,
            "data": response,
        }
    )


@tracer.capture_method
def record_handler(record: SQSRecord):
    payload: str = record.body
    message: dict = json.loads(payload)
    detail: dict = json.loads(message["Message"])
    logger.info("Incoming request", detail=detail)

    if detail["action"] == ChatbotAction.RUN.value:
        handle_run(detail)


def handle_failed_records(records):
    for triplet in records:
        status, error, record = triplet
        payload: str = record.body
        message: dict = json.loads(payload)
        detail: dict = json.loads(message["Message"])
        logger.info(detail)
        user_id = detail["userId"]
        data = detail.get("data", {})
        session_id = data.get("sessionId", "")

        message = "⚠️ *Something went wrong*"
        if (
            "An error occurred (ValidationException)" in error
            and "The provided image must have dimensions in set [1280x720]" in error
        ):
            # At this time only one input size is supported by the Nova reel model.
            message = "⚠️ *The provided image must have dimensions of 1280x720.*"

        elif (
            "An error occurred (AccessDeniedException)" in error
            and "You don't have access to the model with the specified model ID"
            in error
        ):
            message = (
                "*This model is not enabled. "
                "Please try again later or contact "
                "an administrator*"
            )

        send_to_client(
            {
                "type": "text",
                "action": ChatbotAction.FINAL_RESPONSE.value,
                "userId": user_id,
                "timestamp": str(int(round(datetime.now().timestamp()))),
                "data": {
                    "sessionId": session_id,
                    "content": message,
                    "type": "text",
                },
            }
        )


@logger.inject_lambda_context(log_event=False)
@tracer.capture_lambda_handler
def handler(event, context: LambdaContext):
    batch = event["Records"]

    try:
        with processor(records=batch, handler=record_handler):
            processed_messages = processor.process()
    except BatchProcessingError as e:
        logger.exception(e)

    for message in processed_messages:
        logger.info(
            "Request compelte with status " + message[0],
            status=message[0],
            cause=message[1],
        )
    handle_failed_records(
        message for message in processed_messages if message[0] == "fail"
    )

    return processor.response()


def is_admin_role(user_groups):
    if user_groups and ("admin" in user_groups or "workspace_manager" in user_groups):
        return True
    return False
