import os
from aws_lambda_powertools import Logger
import boto3
from botocore.exceptions import ClientError

AWS_REGION = os.environ["AWS_REGION"]
SESSIONS_TABLE_NAME = os.environ["SESSIONS_TABLE_NAME"]
SESSIONS_BY_USER_ID_INDEX_NAME = os.environ["SESSIONS_BY_USER_ID_INDEX_NAME"]


dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
table = dynamodb.Table(SESSIONS_TABLE_NAME)
s3 = boto3.resource("s3")
logger = Logger()


def get_session(session_id, user_id):
    response = {}
    try:
        response = table.get_item(Key={"SessionId": session_id, "UserId": user_id})
    except ClientError as error:
        if error.response["Error"]["Code"] == "ResourceNotFoundException":
            logger.warning("No record found with session id: %s", session_id)
        else:
            logger.exception(error)

    return response.get("Item", {})


def list_sessions_by_user_id(user_id):
    items = []
    try:
        last_evaluated_key = None
        while True:
            if last_evaluated_key:
                response = table.query(
                    KeyConditionExpression="UserId = :user_id",
                    ExpressionAttributeValues={":user_id": user_id},
                    IndexName=SESSIONS_BY_USER_ID_INDEX_NAME,
                    ExclusiveStartKey=last_evaluated_key,
                )
            else:
                response = table.query(
                    KeyConditionExpression="UserId = :user_id",
                    ExpressionAttributeValues={":user_id": user_id},
                    IndexName=SESSIONS_BY_USER_ID_INDEX_NAME,
                )

            items.extend(response.get("Items", []))

            last_evaluated_key = response.get("LastEvaluatedKey")
            if not last_evaluated_key:
                break

    except ClientError as error:
        if error.response["Error"]["Code"] == "ResourceNotFoundException":
            logger.warning("No record found for user id: %s", user_id)
        else:
            logger.exception(error)

    return items


def delete_session(session_id, user_id):
    try:
        session = table.get_item(Key={"SessionId": session_id, "UserId": user_id}).get(
            "Item", {}
        )
        for item in session.get("History"):
            metadata = item.get("data", {}).get("additional_kwargs", {})
            for file in (
                metadata.get("images", [])
                + metadata.get("documents", [])
                + metadata.get("videos", [])
            ):
                if not isinstance(file, dict) or "key" not in file:
                    continue
                key = "private/" + user_id + "/" + file["key"]
                logger.info(
                    "Deleting session file",
                    bucket=os.environ["CHATBOT_FILES_BUCKET_NAME"],
                    key=key,
                )
                s3.Object(os.environ["CHATBOT_FILES_BUCKET_NAME"], key).delete()

        table.delete_item(Key={"SessionId": session_id, "UserId": user_id})
        logger.info("Sessions deleted", sessionId=session_id)
    except ClientError as error:
        if error.response["Error"]["Code"] == "ResourceNotFoundException":
            logger.warning("No record found with session id: %s", session_id)
        else:
            logger.exception(error)

        return {"id": session_id, "deleted": False}

    return {"id": session_id, "deleted": True}


def delete_user_sessions(user_id):
    sessions = list_sessions_by_user_id(user_id)
    ret_value = []

    for session in sessions:
        result = delete_session(session["SessionId"], user_id)
        ret_value.append({"id": session["SessionId"], "deleted": result["deleted"]})

    return ret_value
