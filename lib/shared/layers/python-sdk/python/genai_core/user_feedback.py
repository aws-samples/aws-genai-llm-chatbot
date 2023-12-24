import os
import uuid
import boto3
from datetime import datetime

dynamodb = boto3.resource("dynamodb")

USER_FEEDBACK_TABLE_NAME = os.environ.get("USER_FEEDBACK_TABLE_NAME")

if USER_FEEDBACK_TABLE_NAME:
    table = dynamodb.Table(USER_FEEDBACK_TABLE_NAME)

def add_user_feedback(
    session_id: str,
    user_id: str,
    key: str,
    feedback: str 
):
    feedback_id = str(uuid.uuid4())
    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%fZ")

    item = {
        "FeedbackId": feedback_id,
        "SessionId": session_id,
        "UserId": user_id,
        "Key": key,
        "Feedback": feedback,
        "CreatedAt": timestamp
    }

    response = table.put_item(Item=item)
    print(response)

    return {
        "id": feedback_id
    }
