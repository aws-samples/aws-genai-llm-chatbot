import json
from aws_lambda_powertools import Logger
import boto3
from typing import List
from decimal import Decimal
from datetime import datetime
from botocore.exceptions import ClientError
from langchain_core.messages.ai import AIMessage, AIMessageChunk
from operator import itemgetter

from langchain.schema import BaseChatMessageHistory
from langchain.schema.messages import (
    BaseMessage,
    _message_to_dict,
    _message_from_dict,
)
from genai_core.sessions import delete_session

client = boto3.resource("dynamodb")
logger = Logger(level="DEBUG")


class DynamoDBChatMessageHistory(BaseChatMessageHistory):
    def __init__(
        self,
        table_name: str,
        session_id: str,
        user_id: str,
        max_messages: int = None,  # Added max_messages parameter
    ):
        self.table = client.Table(table_name)
        self.session_id = session_id
        self.user_id = user_id
        self.max_messages = max_messages  # Store max_messages

    def _get_full_history(self) -> List[BaseMessage]:
        """Query all messages from DynamoDB for the current session"""
        response = self.table.query(
            KeyConditionExpression=(
                "#pk = :user_id AND begins_with(#sk, :session_prefix)"
            ),
            FilterExpression="#itemType = :itemType",
            ExpressionAttributeNames={
                "#pk": "PK",
                "#sk": "SK",
                "#itemType": "ItemType",
            },
            ScanIndexForward=True,
            ExpressionAttributeValues={
                ":user_id": f"USER#{self.user_id}",
                ":session_prefix": f"SESSION#{self.session_id}",
                ":itemType": "message",
            },
        )
        items = response.get("Items", [])

        return items

    @property
    def messages(self) -> List[BaseMessage]:
        """Get the last max_messages from the full history"""
        full_history_items = self._get_full_history()

        # Hande case where max_messages is None
        if self.max_messages is None:
            self.max.messages = len(full_history_items)

        # Slice before processing
        relevant_items = full_history_items[-self.max_messages :]

        # Use itemgetter and list comprehension
        get_history_data = itemgetter("History")
        return [
            _message_from_dict(get_history_data(item) or "") for item in relevant_items
        ]

    def add_message(self, message: BaseMessage) -> None:
        """Append the message to the record in DynamoDB"""
        try:
            current_time = datetime.now().isoformat()

            # messages = messages_to_dict(self.messages)
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

            try:
                self.table.update_item(
                    Key={
                        "PK": f"USER#{self.user_id}",
                        "SK": f"SESSION#{self.session_id}",
                    },
                    UpdateExpression="SET LastUpdateTime = :time",
                    ConditionExpression="attribute_exists(PK)",
                    ExpressionAttributeValues={":time": current_time},
                )
            except ClientError as err:
                if err.response["Error"]["Code"] == "ConditionalCheckFailedException":
                    # Session doesn't exist, so create a new one
                    self.table.put_item(
                        Item={
                            "PK": f"USER#{self.user_id}",
                            "SK": f"SESSION#{self.session_id}",
                            "Title": _message_to_dict(message)
                            .get("data", {})
                            .get("content", "<no title>"),
                            "StartTime": current_time,
                            "ItemType": "session",
                            "SessionId": self.session_id,
                            "LastUpdateTime": current_time,
                        }
                    )
                else:
                    # If some other error occurs, re-raise the exception
                    raise

            self.table.put_item(
                Item={
                    "PK": f"USER#{self.user_id}",
                    "SK": f"SESSION#{self.session_id}#{current_time}",
                    "StartTime": current_time,
                    "History": _message,  # Store full history in DynamoDB
                    "ItemType": "message",
                    "Role": _message.get("type"),
                }
            )
        except ClientError as err:
            logger.exception(err)

    def add_metadata(self, metadata: dict) -> None:
        """Add additional metadata to the last message"""
        full_history_items = self._get_full_history()
        if not full_history_items:
            return

        metadata = json.loads(json.dumps(metadata), parse_float=Decimal)

        most_recent_history = full_history_items[-1]

        most_recent_history["History"]["data"]["additional_kwargs"] = metadata

        try:

            # Perform the update operation
            self.table.update_item(
                Key={
                    "PK": f"USER#{self.user_id}",
                    "SK": (
                        f"SESSION#{self.session_id}"
                        f"#{most_recent_history['StartTime']}"
                    ),
                },
                UpdateExpression="SET #data = :data",
                ExpressionAttributeNames={
                    "#data": "History"
                },
                ExpressionAttributeValues={
                    ":data": most_recent_history["History"]
                },
            )

        except Exception as err:
            logger.exception(err)
            logger.exception(f"Failed to update metadata: {err}")

    def clear(self) -> None:
        """Clear session memory from DynamoDB"""
        try:
            delete_session(self.session_id, self.user_id)

        except ClientError as err:
            logger.exception(err)
