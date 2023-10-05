import os
import boto3
from botocore.exceptions import ClientError

AWS_REGION = os.environ["AWS_REGION"]
SESSIONS_TABLE_NAME = os.environ["SESSIONS_TABLE_NAME"]
SESSIONS_BY_USER_ID_INDEX_NAME = os.environ["SESSIONS_BY_USER_ID_INDEX_NAME"]


dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
table = dynamodb.Table(SESSIONS_TABLE_NAME)


def get_session(session_id, user_id):
    response = {}
    try:
        response = table.get_item(Key={"SessionId": session_id, "UserId": user_id})
    except ClientError as error:
        if error.response["Error"]["Code"] == "ResourceNotFoundException":
            print("No record found with session id: %s", session_id)
        else:
            print(error)

    return response.get("Item", {})


def list_sessions_by_user_id(user_id):
    response = {}
    try:
        response = table.query(
            KeyConditionExpression="UserId = :user_id",
            ExpressionAttributeValues={":user_id": user_id},
            IndexName=SESSIONS_BY_USER_ID_INDEX_NAME,
        )
    except ClientError as error:
        if error.response["Error"]["Code"] == "ResourceNotFoundException":
            print("No record found for user id: %s", user_id)
        else:
            print(error)

    return response.get("Items", [])


def delete_session(session_id, user_id):
    try:
        table.delete_item(Key={"SessionId": session_id, "UserId": user_id})
    except ClientError as error:
        if error.response["Error"]["Code"] == "ResourceNotFoundException":
            print("No record found with session id: %s", session_id)
        else:
            print(error)

        return {"deleted": False}

    return {"deleted": True}


def delete_user_sessions(user_id):
    sessions = list_sessions_by_user_id(user_id)
    ret_value = []

    for session in sessions:
        result = delete_session(session["SessionId"], user_id)
        ret_value.append({"id": session["SessionId"], "deleted": result["deleted"]})

    return ret_value
