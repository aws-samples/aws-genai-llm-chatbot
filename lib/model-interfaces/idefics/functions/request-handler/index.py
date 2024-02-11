import os
import json
import uuid
from datetime import datetime
from urllib.parse import urljoin

from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.batch import BatchProcessor, EventType
from aws_lambda_powertools.utilities.batch.exceptions import BatchProcessingError
from aws_lambda_powertools.utilities.data_classes.sqs_event import SQSRecord
from aws_lambda_powertools.utilities.typing import LambdaContext

from langchain.llms import SagemakerEndpoint

from genai_core.langchain import DynamoDBChatMessageHistory
from genai_core.utils.websocket import send_to_client
from genai_core.types import ChatbotAction, ChatbotMessageType

from content_handler import ContentHandler

processor = BatchProcessor(event_type=EventType.SQS)
tracer = Tracer()
logger = Logger()


def handle_run(record):
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

    params = {
        "do_sample": True,
        "top_p": 0.2,
        "temperature": 0.4,
        "top_k": 50,
        "max_new_tokens": 512,
        "stop": ["User:", "<end_of_utterance>"],
    }
    print(model_kwargs)
    params = {}
    if "temperature" in model_kwargs:
        params["temperature"] = model_kwargs["temperature"]
    if "topP" in model_kwargs:
        params["top_p"] = model_kwargs["topP"]
    if "maxTokens" in model_kwargs:
        params["max_new_tokens"] = model_kwargs["maxTokens"]

    human_prompt_template = "User:{prompt}"
    human_prompt_with_image = "User:{prompt}![]({image})"
    ai_prompt_template = "Assistant:{prompt}"

    prompts = []
    for message in messages:
        if message.type.lower() == ChatbotMessageType.Human.value.lower():
            message_files = message.additional_kwargs.get("files", [])
            if not message_files:
                prompts.append(human_prompt_template.format(prompt=message.content))
            for message_file in message_files:
                prompts.append(
                    human_prompt_with_image.format(
                        prompt=message.content,
                        image=f"{urljoin(os.environ['CHATBOT_FILES_PRIVATE_API'], message_file['key'])}",
                    )
                )
        if message.type.lower() == ChatbotMessageType.AI.value.lower():
            prompts.append(ai_prompt_template.format(prompt=message.content))

    if not files:
        prompts.append(human_prompt_template.format(prompt=prompt))

    for file in files:
        key = file["key"]
        prompts.append(
            human_prompt_with_image.format(
                prompt=prompt,
                image=f"{urljoin(os.environ['CHATBOT_FILES_PRIVATE_API'], key)}",
            )
        )

    prompts.append("<end_of_utterance>\nAssistant:")

    prompt_template = "".join(prompts)
    print(prompt_template)

    mlm = SagemakerEndpoint(
        endpoint_name=model_id,
        region_name=os.environ["AWS_REGION"],
        model_kwargs=params,
        content_handler=ContentHandler(),
    )

    mlm_response = mlm.predict(prompt_template)

    metadata = {
        "provider": provider,
        "modelId": model_id,
        "modelKwargs": model_kwargs,
        "mode": mode,
        "sessionId": session_id,
        "userId": user_id,
        "prompts": [prompt_template],
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
    logger.info(detail)

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
                    "content": str(error),
                    "type": "text",
                },
            }
        )


@logger.inject_lambda_context(log_event=True)
@tracer.capture_lambda_handler
def handler(event, context: LambdaContext):
    batch = event["Records"]

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
