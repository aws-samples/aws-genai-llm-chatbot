import json
import os
import uuid
from datetime import datetime

import boto3
from adapters.registry import registry
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities import parameters
from aws_lambda_powertools.utilities.batch import SqsFifoPartialProcessor
from aws_lambda_powertools.utilities.batch.exceptions import BatchProcessingError
from aws_lambda_powertools.utilities.data_classes.sqs_event import SQSRecord
from aws_lambda_powertools.utilities.typing import LambdaContext
from models import list_models
from rag_sources import list_rag_sources
from sessions import (
    list_sessions_by_user_id,
    get_session,
    delete_session,
    delete_user_sessions,
)

processor = SqsFifoPartialProcessor()
tracer = Tracer()
logger = Logger()

sns = boto3.client("sns", region_name=os.environ["AWS_REGION"])


def send_to_client(detail):
    sns.publish(
        TopicArn=os.environ["MESSAGES_TOPIC_ARN"],
        MessageGroupId=detail["userId"],
        Message=json.dumps(detail),
    )


def on_llm_new_token(connection_id, user_id, session_id, self, token, *args, **kwargs):
    send_to_client(
        {
            "type": "text",
            "action": "llm_new_token",
            "direction": "OUT",
            "connectionId": connection_id,
            "userId": user_id,
            "timestamp": str(int(round(datetime.now().timestamp()))),
            "data": {
                "sessionId": session_id,
                "token": token,
            },
        }
    )


def handle_list_models(record):
    connection_id = record["connectionId"]
    user_id = record["userId"]
    send_to_client(
        {
            "type": "text",
            "action": "listModels",
            "direction": "OUT",
            "connectionId": connection_id,
            "userId": user_id,
            "timestamp": str(int(round(datetime.now().timestamp()))),
            "data": list_models(),
        }
    )


def handle_list_rag_sources(record):
    connection_id = record["connectionId"]
    user_id = record["userId"]
    send_to_client(
        {
            "type": "text",
            "action": "listRagSources",
            "direction": "OUT",
            "connectionId": connection_id,
            "userId": user_id,
            "timestamp": str(int(round(datetime.now().timestamp()))),
            "data": list_rag_sources(),
        }
    )


def handle_list_sessions(record):
    connection_id = record["connectionId"]
    user_id = record["userId"]
    send_to_client(
        {
            "type": "text",
            "action": "listSessions",
            "direction": "OUT",
            "connectionId": connection_id,
            "userId": user_id,
            "timestamp": str(int(round(datetime.now().timestamp()))),
            "data": list_sessions_by_user_id(user_id),
        }
    )


def handle_get_session(record):
    connection_id = record["connectionId"]
    user_id = record["userId"]
    data = record.get("data", {})
    session_id = data.get("sessionId", "")
    send_to_client(
        {
            "type": "text",
            "action": "getSession",
            "direction": "OUT",
            "connectionId": connection_id,
            "userId": user_id,
            "timestamp": str(int(round(datetime.now().timestamp()))),
            "data": get_session(session_id, user_id),
        }
    )


def handle_delete_session(record):
    connection_id = record["connectionId"]
    user_id = record["userId"]
    data = record.get("data", {})
    session_id = data.get("sessionId", "")
    send_to_client(
        {
            "type": "text",
            "action": "deleteSession",
            "direction": "OUT",
            "connectionId": connection_id,
            "userId": user_id,
            "timestamp": str(int(round(datetime.now().timestamp()))),
            "data": delete_session(session_id, user_id),
        }
    )


def handle_delete_user_sessions(record):
    connection_id = record["connectionId"]
    user_id = record["userId"]
    record.get("data", {})
    send_to_client(
        {
            "type": "text",
            "action": "deleteUserSessions",
            "direction": "OUT",
            "connectionId": connection_id,
            "userId": user_id,
            "timestamp": str(int(round(datetime.now().timestamp()))),
            "data": delete_user_sessions(user_id),
        }
    )


def handle_run(record):
    connection_id = record["connectionId"]
    user_id = record["userId"]
    data = record["data"]
    provider = data["provider"]
    model_id = data["modelId"]
    mode = data["mode"]
    prompt = data["text"]
    rag_source = data.get("ragSource", None)

    session_id = data.get("sessionId")

    if not session_id:
        session_id = str(uuid.uuid4())

    adapter = registry.get_adapter(f"{provider}.{model_id}")

    adapter.on_llm_new_token = lambda *args, **kwargs: on_llm_new_token(
        connection_id, user_id, session_id, *args, **kwargs
    )

    model = adapter(
        model_id=model_id,
        mode=mode,
        session_id=session_id,
        user_id=user_id,
        model_kwargs=data.get("modelKwargs", {}),
    )

    response = model.run(
        prompt=prompt,
        rag_source=rag_source,
        tools=[],
    )
    logger.info(response)

    send_to_client(
        {
            "type": "text",
            "action": "final_response",
            "direction": "OUT",
            "connectionId": connection_id,
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
    logger.info(detail)

    if detail["action"] == "run":
        handle_run(detail)
    if detail["action"] == "listModels":
        handle_list_models(detail)
    if detail["action"] == "listRagSources":
        handle_list_rag_sources(detail)
    if detail["action"] == "listSessions":
        handle_list_sessions(detail)
    if detail["action"] == "getSession":
        handle_get_session(detail)
    if detail["action"] == "deleteSession":
        handle_delete_session(detail)
    if detail["action"] == "deleteUserSessions":
        handle_delete_user_sessions(detail)


def handle_failed_records(records):
    for triplet in records:
        status, error, record = triplet
        payload: str = record.body
        message: dict = json.loads(payload)
        detail: dict = json.loads(message["Message"])
        logger.info(detail)
        connection_id = detail["connectionId"]
        user_id = detail["userId"]
        data = detail.get("data", {})
        session_id = data.get("sessionId", "")

        send_to_client(
            {
                "type": "text",
                "action": "error",
                "direction": "OUT",
                "connectionId": connection_id,
                "userId": user_id,
                "timestamp": str(int(round(datetime.now().timestamp()))),
                "data": {
                    "sessionId": session_id,
                    "content": str(error),
                    "type": "text",
                },
            }
        )


@logger.inject_lambda_context(log_event=True)
@tracer.capture_lambda_handler
def handler(event, context: LambdaContext):
    batch = event["Records"]

    api_keys = parameters.get_secret(
        os.environ["API_KEYS_SECRETS_ARN"], transform="json"
    )
    for key in api_keys:
        os.environ[key] = api_keys[key]

    try:
        with processor(records=batch, handler=record_handler):
            processed_messages = processor.process()
    except BatchProcessingError as e:
        logger.error(e)

    logger.info(processed_messages)
    handle_failed_records(
        message for message in processed_messages if message[0] == "fail"
    )

    return processor.response()
