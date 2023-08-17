import json
import os
from datetime import datetime

import boto3

# from adapters.bedrock import BedrockAdapter
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.typing import LambdaContext

tracer = Tracer()
logger = Logger(log_uncaught_exceptions=True)
sns = boto3.client("sns", region_name=os.environ["AWS_REGION"])

api_gateway_management_api = boto3.client(
    "apigatewaymanagementapi",
    endpoint_url=os.environ["WEBSOCKET_API_ENDPOINT"],
)


def handle_message(connection_id, user_id, body):
    action = body["action"]
    data = body.get("data", {})

    return handle_request(connection_id, user_id, action, data)


def handle_request(connection_id, user_id, action, data):
    message = {
        "type": "text",
        "action": action,
        "direction": "IN",
        "connectionId": connection_id,
        "timestamp": str(int(round(datetime.now().timestamp()))),
        "userId": user_id,
        "data": data,
    }
    logger.info(message)
    response = sns.publish(
        TopicArn=os.environ["MESSAGES_TOPIC_ARN"],
        MessageGroupId=user_id,
        Message=json.dumps(message),
    )

    return {"statusCode": 200, "body": json.dumps(response)}


@tracer.capture_lambda_handler
@logger.inject_lambda_context(log_event=True)
def handler(event, context: LambdaContext):
    event_type = event["requestContext"]["eventType"]
    connection_id = event["requestContext"]["connectionId"]
    user_id = event["requestContext"]["authorizer"]["username"]

    logger.set_correlation_id(connection_id)
    tracer.put_annotation(key="ConnectionId", value=connection_id)
    tracer.put_annotation(key="UserId", value=user_id)

    if event_type == "MESSAGE":
        message = json.loads(event["body"])
        return handle_message(connection_id, user_id, message)

    return {
        "statusCode": 400,
        "body": json.dumps({"message": f"Unhandled event type {event_type}"}),
    }


def send_message(connection_id, message):
    print(f"Sending message {message} to {connection_id}")

    api_gateway_management_api.post_to_connection(
        ConnectionId=connection_id, Data=json.dumps(message)
    )
