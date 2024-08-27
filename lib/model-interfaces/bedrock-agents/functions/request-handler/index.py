import os
import json
import uuid
from datetime import datetime
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities import parameters
from aws_lambda_powertools.utilities.batch import BatchProcessor, EventType
from aws_lambda_powertools.utilities.batch.exceptions import BatchProcessingError
from aws_lambda_powertools.utilities.data_classes.sqs_event import SQSRecord
from aws_lambda_powertools.utilities.typing import LambdaContext
from adapters.bedrock import BedrockAgent, AgentInputOutputAdapter

from genai_core.utils.websocket import send_to_client
from genai_core.types import ChatbotAction

processor = BatchProcessor(event_type=EventType.SQS)
tracer = Tracer()
logger = Logger()

AWS_REGION = os.environ["AWS_REGION"]
CONFIG_PARAMETER_NAME = os.environ["CONFIG_PARAMETER_NAME"]

sequence_number = 0
config = json.loads(parameters.get_parameter(CONFIG_PARAMETER_NAME))


def handle_run(record):
    user_id = record["userId"]
    data = record["data"]
    agent_id = data["agentId"]
    prompt = data["text"]
    session_id = data.get("sessionId")

    if not session_id:
        session_id = str(uuid.uuid4())

    # get the adapter from the registry

    # create an agent adapter to invoke a Bedrock Agent using agentId and agentAliasId
    agent = BedrockAgent(
        agent_id=agent_id,
        user_id=user_id,
        session_id=session_id,
        region_name=config.get("bedrock", {}).get("region", AWS_REGION),
    )
    # call the agent
    response = agent.run(
        prompt,
    )

    logger.info("Bedrock Agent response", response=response)
    sequence_number = 0
    run_id = str(uuid.uuid4())
    for r in response:
        # this is specific to Bedrock agents, would need a way to generalize
        # it if we are to introduce other agents
        if "chunk" in list(r.keys()):
            send_to_client(
                {
                    "type": "text",
                    "action": ChatbotAction.FINAL_RESPONSE.value,
                    "timestamp": str(int(round(datetime.now().timestamp()))),
                    "userId": user_id,
                    "data": {
                        "sessionId": session_id,
                        "type": "text",
                        "content": AgentInputOutputAdapter.prepare_agent_answer(
                            r["chunk"]
                        ),
                        "metadata": {
                            "modelId": agent_id,
                            "modelKwargs": None,
                            "mode": "agent",
                            "sessionId": session_id,
                            "userId": user_id,
                            "documents": [],
                            "prompts": [prompt],
                        },
                    },
                }
            )
        if "trace" in list(r.keys()):
            send_to_client(
                {
                    "type": "text",
                    "action": ChatbotAction.AGENT_TRACE.value,
                    "timestamp": str(int(round(datetime.now().timestamp()))),
                    "userId": user_id,
                    "data": {
                        "sessionId": session_id,
                        "type": "text",
                        "sequence": sequence_number,
                        "runId": run_id,
                        "content": json.dumps(r["trace"]),
                        "metadata": {
                            "modelId": agent_id,
                            "modelKwargs": None,
                            "mode": "agent",
                        },
                    },
                }
            )
            sequence_number += 1


@tracer.capture_method
def record_handler(record: SQSRecord):
    payload: str = record.body
    message: dict = json.loads(payload)
    detail: dict = json.loads(message["Message"])
    logger.info("Incoming event", detail=detail)

    if detail["action"] == ChatbotAction.RUN.value:
        handle_run(detail)
    elif detail["action"] == ChatbotAction.HEARTBEAT.value:
        pass


def handle_failed_records(records):
    for triplet in records:
        _, error, record = triplet
        payload: str = record.body
        message: dict = json.loads(payload)
        detail: dict = json.loads(message["Message"])
        logger.info("Failed event", detail=detail)
        user_id = detail["userId"]
        data = detail.get("data", {})
        session_id = data.get("sessionId", "")

        send_to_client(
            {
                "type": "text",
                "action": "error",
                "direction": "OUT",
                "userId": user_id,
                "timestamp": str(int(round(datetime.now().timestamp()))),
                "data": {
                    "sessionId": session_id,
                    "content": "Something went wrong",
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

    for message in processed_messages:
        logger.info(
            "Request complete with status " + message[0],
            status=message[0],
            cause=message[1],
        )
    handle_failed_records(
        message for message in processed_messages if message[0] == "fail"
    )

    return processor.response()
