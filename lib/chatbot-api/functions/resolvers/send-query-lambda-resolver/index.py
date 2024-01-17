import boto3
import os
import json
from datetime import datetime
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.typing import LambdaContext

tracer = Tracer()
logger = Logger(log_uncaught_exceptions=True)

sns = boto3.client("sns")
TOPIC_ARN=os.environ.get("SNS_TOPIC_ARN", "")

@tracer.capture_lambda_handler
@logger.inject_lambda_context(log_event=True)
def handler(event, context: LambdaContext): 
    print(event["arguments"]["data"])
    print(event["identity"])
    request = json.loads(event["arguments"]["data"])
    message = {
        "action": request["action"],
        "modelInterface": request["modelInterface"],
        "direction": "IN",
        "timestamp": str(int(round(datetime.now().timestamp()))),
        "userId": event["identity"]["sub"],
        "data": request.get("data", {}),
    }
    print(message)

    response = sns.publish(
        TopicArn=TOPIC_ARN, Message=json.dumps(message)
        )
    
    return response
    