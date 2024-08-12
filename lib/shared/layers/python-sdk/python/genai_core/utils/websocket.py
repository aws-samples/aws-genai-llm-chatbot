import json
import os

import boto3
from ..types import Direction

sns = boto3.client("sns")


def send_to_client(detail, topic_arn=None):
    if "direction" not in detail:
        detail["direction"] = Direction.OUT.value

    if not topic_arn:
        topic_arn = os.environ["MESSAGES_TOPIC_ARN"]

    sns.publish(
        TopicArn=topic_arn,
        Message=json.dumps(detail),
    )
