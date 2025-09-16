import json
import os
import base64
from decimal import Decimal

import boto3
from ..types import Direction

sns = boto3.client("sns")


# Custom JSON encoder to handle bytes, EventStream, and other non-serializable types
class CustomJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, bytes):
            return base64.b64encode(obj).decode('utf-8')
        elif isinstance(obj, Decimal):
            return float(obj)
        elif hasattr(obj, '__dict__'):
            # Handle objects with __dict__ attribute (like EventStream)
            return str(obj)
        return super().default(obj)


def send_to_client(detail, topic_arn=None):
    if "direction" not in detail:
        detail["direction"] = Direction.OUT.value

    if not topic_arn:
        topic_arn = os.environ["MESSAGES_TOPIC_ARN"]

    sns.publish(
        TopicArn=topic_arn,
        Message=json.dumps(detail, cls=CustomJSONEncoder),
    )
