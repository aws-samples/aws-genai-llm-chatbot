import os
from aws_lambda_powertools import Logger
import boto3
from botocore.exceptions import ClientError
from typing import List, Dict, Any

AWS_REGION = os.environ["AWS_REGION"]
SESSIONS_TABLE_NAME = os.environ["SESSIONS_TABLE_NAME"]


dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
table = dynamodb.Table(SESSIONS_TABLE_NAME)
logger = Logger()


def _get_messages_by_session_id(session_id, user_id):
    items = []
    try:
        response = table.query(
            KeyConditionExpression=(
                "#pk = :user_id AND begins_with(#sk, :session_prefix)"
            ),
            FilterExpression="#item_type = :session_type",
            ExpressionAttributeNames={
                "#pk": "PK",
                "#sk": "SK",
                "#item_type": "ItemType",
            },
            ExpressionAttributeValues={
                ":user_id": f"USER#{user_id}",
                ":session_prefix": f"SESSION#{session_id}",
                ":session_type": "message",
            },
            ScanIndexForward=True,
        )

        items = response.get("Items", [])

        # If there are more items, continue querying
        while "LastEvaluatedKey" in response:
            response = table.query(
                KeyConditionExpression=(
                    "#pk = :user_id AND begins_with(#sk, :session_prefix)"
                ),
                ExpressionAttributeNames={"#pk": "PK", "#sk": "SK"},
                ExpressionAttributeValues={
                    ":user_id": f"USER#{user_id}",
                    ":session_prefix": f"SESSION#{session_id}",
                },
                ScanIndexForward=True,
            )
            items.extend(response.get("Items", []))

    except ClientError as error:
        if error.response["Error"]["Code"] == "ResourceNotFoundException":
            logger.warning("No record found with session id: %s", session_id)
        else:
            logger.exception(error)

    return items


def get_session(session_id, user_id):
    try:
        items = _get_messages_by_session_id(session_id, user_id)

        # Build data structure so that it can be returned to the client
        returnItem = {
            "SessionId": session_id,
            "UserId": user_id,
            "History": [],
            "StartTime": None,
        }

        for item in items:
            if "ItemType" in item:
                if item["ItemType"] == "message":
                    returnItem["History"].append(item["History"])
                    returnItem["StartTime"] = item["StartTime"]

    except ClientError as error:
        if error.response["Error"]["Code"] == "ResourceNotFoundException":
            logger.warning("No record found with session id: %s", session_id)
        else:
            logger.exception(error)

    return returnItem


def list_sessions_by_user_id(user_id: str) -> List[Dict[str, Any]]:
    """
    List all sessions for a given user ID.

    Args:
        user_id (str): The ID of the user.

    Returns:
        List[Dict[str, Any]]: A list of session items.
    """
    session_items = []
    try:
        last_evaluated_key = None
        while True:
            query_params = {
                "KeyConditionExpression": (
                    "#pk = :user_id AND begins_with(#sk, :session_prefix)"
                ),
                "FilterExpression": "#item_type = :session_type",
                "ExpressionAttributeNames": {
                    "#pk": "PK",
                    "#sk": "SK",
                    "#item_type": "ItemType",
                },
                "ExpressionAttributeValues": {
                    ":user_id": f"USER#{user_id}",
                    ":session_prefix": "SESSION#",
                    ":session_type": "session",
                },
            }

            if last_evaluated_key:
                query_params["ExclusiveStartKey"] = last_evaluated_key

            response = table.query(**query_params)

            session_items.extend(response.get("Items", []))

            last_evaluated_key = response.get("LastEvaluatedKey")
            if not last_evaluated_key:
                break

        logger.info(f"Retrieved {len(session_items)} sessions for user {user_id}")
    except ClientError as error:
        if error.response["Error"]["Code"] == "ResourceNotFoundException":
            logger.warning(f"No records found for user id: {user_id}")
        else:
            logger.exception(f"Error retrieving sessions for user {user_id}: {error}")

    return session_items


def delete_session(session_id, user_id):
    try:
        session_history = _get_messages_by_session_id(session_id, user_id)

        if not session_history:
            return {"id": session_id, "deleted": False}

        # Delete messages in session history
        for item in session_history:
            table.delete_item(
                Key={
                    "PK": item["PK"],
                    "SK": item["SK"],
                }
            )

        # Delete the session item
        table.delete_item(
            Key={
                "PK": f"USER#{user_id}",
                "SK": f"SESSION#{session_id}",
            }
        )

    except ClientError as error:
        if error.response["Error"]["Code"] == "ResourceNotFoundException":
            logger.warning("No record found with session id: %s", session_id)
        else:
            logger.exception(error)

        return {"id": session_id, "deleted": False}

    return {"id": session_id, "deleted": True}


def delete_user_sessions(user_id):
    try:
        sessions = list_sessions_by_user_id(user_id)  # Get all sessions for the user
        ret_value = []

        for session in sessions:
            # Extract the session ID from the SK
            # (assuming SK is in the format 'SESSION#<session_id>')
            session_id = session["SK"].split("#")[
                1
            ]  # Extracting session ID from 'SESSION#<session_id>'

            # Delete each session
            result = delete_session(session_id, user_id)
            ret_value.append({"id": session_id, "deleted": result["deleted"]})
    except ClientError as error:
        if error.response["Error"]["Code"] == "ResourceNotFoundException":
            logger.warning("No record found for user id: %s", user_id)
        else:
            logger.exception(error)

    return ret_value
