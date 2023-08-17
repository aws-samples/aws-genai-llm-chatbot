import boto3
import os

from botocore.exceptions import ClientError
from aws_lambda_powertools import Logger

logger = Logger()

dynamodb = boto3.resource("dynamodb", region_name=os.environ["AWS_REGION"])
table = dynamodb.Table(os.environ["SESSIONS_TABLE_NAME"])


def get_session(session_id, user_id):
    response = {}
    try:
        response = table.get_item(Key={"SessionId": session_id, "UserId": user_id})
    except ClientError as error:
        if error.response["Error"]["Code"] == "ResourceNotFoundException":
            logger.warning("No record found with session id: %s", session_id)
        else:
            logger.error(error)

    return response.get("Item", {})


def list_sessions_by_user_id(user_id):
    response = {}
    try:
        response = table.query(
            KeyConditionExpression="UserId = :user_id",
            ExpressionAttributeValues={":user_id": user_id},
            IndexName=os.environ["SESSIONS_BY_USER_ID_INDEX_NAME"],
        )
    except ClientError as error:
        if error.response["Error"]["Code"] == "ResourceNotFoundException":
            logger.warning("No record found for user id: %s", user_id)
        else:
            logger.error(error)

    return response.get("Items", [])


def delete_session(session_id, user_id):
    try:
        table.delete_item(Key={"SessionId": session_id, "UserId": user_id})
    except ClientError as error:
        if error.response["Error"]["Code"] == "ResourceNotFoundException":
            logger.warning("No record found with session id: %s", session_id)
        else:
            logger.error(error)

    return {"deleted": True}


def delete_user_sessions(user_id):
    sessions = list_sessions_by_user_id(user_id)
    for session in sessions:
        delete_session(session["SessionId"], user_id)

    return {"deleted": True}
