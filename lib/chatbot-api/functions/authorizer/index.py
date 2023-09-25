import os

import boto3
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.typing import LambdaContext
from botocore.exceptions import ClientError

tracer = Tracer()
logger = Logger(log_uncaught_exceptions=True)

cognito_client = boto3.client("cognito-idp", region_name=os.environ["AWS_REGION"])


@tracer.capture_lambda_handler
@logger.inject_lambda_context(log_event=True)
def handler(event, context: LambdaContext):
    connection_id = event["requestContext"]["connectionId"]
    logger.set_correlation_id(connection_id)
    tracer.put_annotation(key="ConnectionId", value=connection_id)
    id_token = event["queryStringParameters"].get("token")
    if not id_token:
        return generate_policy("Deny", event["methodArn"])
    try:
        response = cognito_client.get_user(AccessToken=id_token)
        logger.debug(response)
    except ClientError as e:
        logger.exception(e)
        return generate_policy("Deny", event["methodArn"])

    tracer.put_annotation(key="UserId", value=response["Username"])
    policy = generate_policy("Allow", event["methodArn"], response["Username"])
    policy["context"] = {"username": response["Username"]}

    logger.debug(policy)
    return policy


def generate_policy(effect, resource, username="username"):
    policy = {
        "principalId": username,
        "policyDocument": {
            "Version": "2012-10-17",
            "Statement": [
                {"Action": "execute-api:Invoke", "Effect": effect, "Resource": resource}
            ],
        },
    }
    return policy
