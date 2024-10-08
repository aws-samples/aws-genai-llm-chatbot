import os
import json
import uuid
from datetime import datetime

from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.batch import BatchProcessor, EventType
from aws_lambda_powertools.utilities.batch.exceptions import BatchProcessingError
from aws_lambda_powertools.utilities.data_classes.sqs_event import SQSRecord
from aws_lambda_powertools.utilities.typing import LambdaContext

import adapters  # noqa: F401 Needed to register the adapters
from genai_core.langchain import DynamoDBChatMessageHistory
from genai_core.utils.websocket import send_to_client
from genai_core.types import ChatbotAction
from genai_core.registry import registry

processor = BatchProcessor(event_type=EventType.SQS)
tracer = Tracer()
logger = Logger()


def handle_run(record):
    logger.info("Incoming request", record=record)
    user_id = record["userId"]
    data = record["data"]
    provider = data["provider"]
    model_id = data["modelName"]
    mode = data["mode"]
    model_kwargs = data.get("modelKwargs", {})
    prompt = data["text"]
    session_id = data.get("sessionId")
    files = data.get("files", [])

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
    model = adapter(model_id=model_id)

    prompt_template = model.format_prompt(
        prompt=prompt,
        messages=messages,
        files=files,
        user_id=user_id,
    )

    mlm_response = model.handle_run(prompt=prompt_template, model_kwargs=model_kwargs)

    metadata = {
        "provider": provider,
        "modelId": model_id,
        "modelKwargs": model_kwargs,
        "mode": mode,
        "sessionId": session_id,
        "userId": user_id,
        "prompts": [model.clean_prompt(prompt_template)],
    }
    if files:
        metadata["files"] = files

    chat_history.add_user_message(prompt)
    chat_history.add_metadata(metadata)
    chat_history.add_ai_message(mlm_response)

    response = {
        "sessionId": session_id,
        "type": "text",
        "content": mlm_response,
        "metadata": metadata,
    }

    send_to_client(
        {
            "type": "text",
            "action": ChatbotAction.FINAL_RESPONSE.value,
            "timestamp": str(int(round(datetime.now().timestamp()))),
            "userId": user_id,
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

        send_to_client(
            {
                "type": "text",
                "action": ChatbotAction.FINAL_RESPONSE.value,
                "userId": user_id,
                "timestamp": str(int(round(datetime.now().timestamp()))),
                "data": {
                    "sessionId": session_id,
                    "content": "Something went wrong.",
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
