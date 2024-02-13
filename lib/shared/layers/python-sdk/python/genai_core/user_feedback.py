import os
import uuid
import boto3
import json
from pydantic import BaseModel
from datetime import datetime

dynamodb = boto3.resource("dynamodb")
s3_client = boto3.client("s3")

USER_FEEDBACK_BUCKET_NAME = os.environ.get("USER_FEEDBACK_BUCKET_NAME")


def add_user_feedback(
    sessionId: str,
    key: str,
    feedback: str,
    prompt: str,
    completion: str,
    model: str,
    userId: str
):
    feedbackId = str(uuid.uuid4())
    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%fZ")
    
    item = {
        "feedbackId": feedbackId,
        "sessionId": sessionId,
        "userId": userId,
        "key": key,
        "prompt": prompt,
        "completion": completion,
        "model": model,
        "feedback": feedback,
        "createdAt": timestamp
    }
    
    response = s3_client.put_object(
        Bucket=USER_FEEDBACK_BUCKET_NAME,
        Key=feedbackId,
        Body=json.dumps(item),
        ContentType="application/json",
        StorageClass='STANDARD_IA',
    )
    print(response)
    
    return {
        "feedback_id": feedbackId
    }
    
    