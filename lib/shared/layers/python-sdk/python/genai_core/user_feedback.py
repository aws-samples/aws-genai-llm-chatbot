import os
import uuid
from aws_lambda_powertools import Logger
import boto3
import json
from datetime import datetime

dynamodb = boto3.resource("dynamodb")
s3_client = boto3.client("s3")
logger = Logger()

USER_FEEDBACK_BUCKET_NAME = os.environ.get("USER_FEEDBACK_BUCKET_NAME")


def add_user_feedback(
    sessionId: str,
    key: str,
    feedback: str,
    prompt: str,
    completion: str,
    model: str,
    userId: str,
):
    feedbackId = str(uuid.uuid4())
    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%fZ")
    prefix = datetime.utcnow().strftime("user_feedback/year=%Y/month=%m/")

    item = {
        "feedbackId": feedbackId,
        "sessionId": sessionId,
        "userId": userId,
        "key": key,
        "prompt": prompt,
        "completion": completion,
        "model": model,
        "feedback": feedback,
        "createdAt": timestamp,
    }

    response = s3_client.put_object(
        Bucket=USER_FEEDBACK_BUCKET_NAME,
        Key=f"{prefix}{feedbackId}.json",
        Body=json.dumps(item),
        ContentType="application/json",
        StorageClass="STANDARD_IA",
    )
    logger.info("Response for add_user_feedback", response=response)

    return {"feedback_id": feedbackId}
