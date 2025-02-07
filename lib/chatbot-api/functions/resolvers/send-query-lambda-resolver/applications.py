import os
import boto3


dynamodb = boto3.resource("dynamodb")

APPLICATIONS_TABLE_NAME = os.environ.get("APPLICATIONS_TABLE_NAME")
if APPLICATIONS_TABLE_NAME:
    table = dynamodb.Table(APPLICATIONS_TABLE_NAME)


def get_application(id: str):
    response = table.get_item(Key={"Id": id})
    item = response.get("Item")

    return item
