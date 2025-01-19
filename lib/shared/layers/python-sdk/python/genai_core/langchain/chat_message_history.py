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
from langchain_core.messages.human import HumanMessage

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
        self.temporary_messages = []
        self.start_time = None

    @property
    def messages(self) -> List[BaseMessage]:
        return self.get_messages_from_storage() + self.temporary_messages

    def get_messages_from_storage(self) -> List[BaseMessage]:
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
            self.start_time = response["Item"]["StartTime"]
        else:
            items = []

        return messages_from_dict(items)

    def add_message(self, message: BaseMessage) -> None:
        """Append the message to the record in DynamoDB"""
        messages = messages_to_dict(self.get_messages_from_storage())
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

    def add_temporary_message(self, message: HumanMessage) -> None:
        """Add a message without storing it (For example images, documents)"""
        self.temporary_messages.append(message)

    def add_metadata(self, metadata: dict) -> None:
        """Add additional metadata to the last message"""
        messages = messages_to_dict(self.get_messages_from_storage())
        if not messages:
            return

        metadata = json.loads(json.dumps(metadata), parse_float=Decimal)
        messages[-1]["data"]["additional_kwargs"] = metadata

        try:
            self.table.put_item(
                Item={
                    "SessionId": self.session_id,
                    "UserId": self.user_id,
                    "StartTime": (
                        datetime.now().isoformat()
                        if self.start_time is None
                        else self.start_time
                    ),
                    "History": messages,
                }
            )

        except Exception as err:
            logger.exception(err)

    def replace_last_message(self, content: str) -> None:
        """Replace the last message. For example when it is blocked by guardrails"""
        messages = messages_to_dict(self.get_messages_from_storage())
        if not messages:
            return

        logger.info(
            "updaing",
            content=content,
            date=self.start_time,
            item={
                "SessionId": self.session_id,
                "UserId": self.user_id,
                "StartTime": (
                    datetime.now().isoformat()
                    if self.start_time is None
                    else self.start_time
                ),
                "History": messages,
            },
        )
        try:
            self.table.put_item(
                Item={
                    "SessionId": self.session_id,
                    "UserId": self.user_id,
                    "StartTime": (
                        datetime.now().isoformat()
                        if self.start_time is None
                        else self.start_time
                    ),
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
