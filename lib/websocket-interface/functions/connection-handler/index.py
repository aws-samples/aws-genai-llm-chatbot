import json
import os

import boto3
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.typing import LambdaContext

tracer = Tracer()
logger = Logger(log_uncaught_exceptions=True)

dynamodb = boto3.resource("dynamodb", region_name=os.environ["AWS_REGION"])
table = dynamodb.Table(os.environ["CONNECTIONS_TABLE_NAME"])


@tracer.capture_lambda_handler
@logger.inject_lambda_context(log_event=True)
def handler(event, context: LambdaContext):
    user_id = event["requestContext"]["authorizer"]["username"]
    connection_id = event["requestContext"]["connectionId"]
    event_type = event["requestContext"]["eventType"]
    logger.set_correlation_id(connection_id)
    tracer.put_annotation(key="ConnectionId", value=connection_id)
    tracer.put_annotation(key="UserId", value=user_id)

    logger.debug(f"user_id: {user_id}")
    logger.debug(f"connection_id: {connection_id}")
    logger.debug(f"event_type: {event_type}")

    if event_type == "CONNECT":
        logger.info(f"Adding connection {connection_id} for user {user_id}")
        table.put_item(
            Item={
                "connectionId": connection_id,
                "userId": user_id,
            }
        )
        logger.info(f"Added connection {connection_id} for user {user_id}")

        return {
            "statusCode": 200,
            "body": json.dumps(
                {
                    "message": event_type,
                    "userId": user_id,
                    "connectionId": connection_id,
                }
            ),
        }

    if event_type == "DISCONNECT":
        logger.info(f"Removing connection {connection_id} for user {user_id}")
        table.delete_item(Key={"connectionId": connection_id})
        logger.info(f"Removed connection {connection_id} for user {user_id}")
        return {
            "statusCode": 200,
            "body": {
                "message": event_type,
                "connectionId": connection_id,
            },
        }

    error_message = f"Unhandled event type {event_type}"
    logger.info(error_message)
    return {
        "statusCode": 400,
        "body": json.dumps({"message": error_message, "error": True}),
    }
