from aws_lambda_powertools import Logger
import boto3
import os

COGNITO_USER_POOL_ID = os.environ.get("COGNITO_USER_POOL_ID")

idp = boto3.client("cognito-idp")

logger = Logger()


def list_roles():
    groups = []

    try:
        # limit number of roles to 200, otherwise UI should be reworked
        paginator = idp.get_paginator("list_groups")
        for page in paginator.paginate(UserPoolId=COGNITO_USER_POOL_ID):
            for group in page["Groups"]:
                groups.append(
                    {
                        "id": group["GroupName"],
                        "name": group["GroupName"],
                    }
                )
                if len(groups) >= 200:
                    break
            if len(groups) >= 200:
                break

        return groups

    except Exception as e:
        logger.error(f"Error listing Cognito user groups: {e}")
        return None
