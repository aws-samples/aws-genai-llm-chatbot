import os
import boto3
import json
import uuid
from datetime import datetime
from adapters.registry import registry
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities import parameters
from aws_lambda_powertools.utilities.batch import BatchProcessor, EventType
from aws_lambda_powertools.utilities.batch.exceptions import BatchProcessingError
from aws_lambda_powertools.utilities.data_classes.sqs_event import SQSRecord
from aws_lambda_powertools.utilities.typing import LambdaContext

processor = BatchProcessor(event_type=EventType.SQS)
tracer = Tracer()
logger = Logger()

AWS_REGION = os.environ["AWS_REGION"]
MESSAGES_TOPIC_ARN = os.environ["MESSAGES_TOPIC_ARN"]
API_KEYS_SECRETS_ARN = os.environ["API_KEYS_SECRETS_ARN"]

sns = boto3.client("sns", region_name=AWS_REGION)
sequence_number = 0


def send_to_client(detail):
    sns.publish(
        TopicArn=MESSAGES_TOPIC_ARN,
        Message=json.dumps(detail),
    )


def on_llm_new_token(connection_id, user_id, session_id, self, token, run_id, *args, **kwargs):
    global sequence_number
    sequence_number += 1
    run_id = str(run_id)

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
                "token": {
                    "runId": run_id,
                    "sequenceNumber": sequence_number,
                    "value": token,
                },
            },
        }
    )


def handle_run(record):
    connection_id = record["connectionId"]
    user_id = record["userId"]
    data = record["data"]
    provider = data["provider"]
    model_id = data["modelName"]
    mode = data["mode"]
    prompt = data["text"]
    workspace_id = data.get("workspaceId", None)
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
        workspace_id=workspace_id,
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

    api_keys = parameters.get_secret(API_KEYS_SECRETS_ARN, transform="json")
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
