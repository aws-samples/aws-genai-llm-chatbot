import json
from aws_lambda_powertools import Logger
import boto3
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
from langchain_core.messages.ai import AIMessage, AIMessageChunk

client = boto3.resource("dynamodb")
logger = Logger()


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
                logger.warning("No record found with session id: %s", self.session_id)
            else:
                logger.exception(error)

        if response and "Item" in response:
            items = response["Item"]["History"]
        else:
            items = []

        messages = messages_from_dict(items)
        return messages

    def add_message(self, message: BaseMessage) -> None:
        """Append the message to the record in DynamoDB"""
        messages = messages_to_dict(self.messages)
        if isinstance(message, AIMessageChunk):
            # When streaming with RunnableWithMessageHistory,
            # it would add a chunk to the history but it expects a text as content.
            ai_message = ""
            for c in message.content:
                if "text" in c:
                    ai_message = ai_message + c.get("text")
            _message = _message_to_dict(AIMessage(ai_message))
        else:
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
            logger.exception(err)

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
            logger.exception(err)

    def clear(self) -> None:
        """Clear session memory from DynamoDB"""
        try:
            self.table.delete_item(
                Key={"SessionId": self.session_id, "UserId": self.user_id}
            )
        except ClientError as err:
            logger.exception(err)
