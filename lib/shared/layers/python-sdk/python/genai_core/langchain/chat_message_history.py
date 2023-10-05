import json
import boto3
import logging
from typing import List
from decimal import Decimal
from datetime import datetime
from botocore.exceptions import ClientError

from langchain.schema import BaseChatMessageHistory
from langchain.schema.messages import (
    BaseMessage,
    _message_to_dict,
    messages_from_dict,
    messages_to_dict,
)

client = boto3.resource("dynamodb")


class DynamoDBChatMessageHistory(BaseChatMessageHistory):
    def __init__(
        self,
        table_name: str,
        session_id: str,
        user_id: str,
    ):
        self.table = client.Table(table_name)
        self.session_id = session_id
        self.user_id = user_id

    @property
    def messages(self) -> List[BaseMessage]:
        """Retrieve the messages from DynamoDB"""
        response = None
        try:
            response = self.table.get_item(
                Key={"SessionId": self.session_id, "UserId": self.user_id}
            )
        except ClientError as error:
            if error.response["Error"]["Code"] == "ResourceNotFoundException":
                print("No record found with session id: %s", self.session_id)
            else:
                print(error)

        if response and "Item" in response:
            items = response["Item"]["History"]
        else:
            items = []

        messages = messages_from_dict(items)
        return messages

    def add_message(self, message: BaseMessage) -> None:
        """Append the message to the record in DynamoDB"""
        messages = messages_to_dict(self.messages)
        _message = _message_to_dict(message)
        messages.append(_message)

        try:
            self.table.put_item(
                Item={
                    "SessionId": self.session_id,
                    "UserId": self.user_id,
                    "StartTime": datetime.now().isoformat(),
                    "History": messages,
                }
            )
        except ClientError as err:
            print(err)

    def add_metadata(self, metadata: dict) -> None:
        """Add additional metadata to the last message"""
        messages = messages_to_dict(self.messages)
        if not messages:
            return

        metadata = json.loads(json.dumps(metadata), parse_float=Decimal)
        messages[-1]["data"]["additional_kwargs"] = metadata

        try:
            self.table.put_item(
                Item={
                    "SessionId": self.session_id,
                    "UserId": self.user_id,
                    "StartTime": datetime.now().isoformat(),
                    "History": messages,
                }
            )

        except Exception as err:
            print(err)

    def clear(self) -> None:
        """Clear session memory from DynamoDB"""
        try:
            self.table.delete_item(
                Key={"SessionId": self.session_id, "UserId": self.user_id}
            )
        except ClientError as err:
            print(err)
