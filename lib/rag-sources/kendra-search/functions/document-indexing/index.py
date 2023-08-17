import os

import boto3
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.batch import (
    BatchProcessor,
    EventType,
    process_partial_response,
)
from aws_lambda_powertools.utilities.data_classes.sqs_event import SQSRecord
from aws_lambda_powertools.utilities.typing import LambdaContext

kendra = boto3.client("kendra", region_name=os.environ["AWS_REGION"])

processor = BatchProcessor(event_type=EventType.SQS)
tracer = Tracer()
logger = Logger()


@tracer.capture_method
def record_handler(record: SQSRecord):
    payload: str = record.json_body
    logger.info(payload)

    response = kendra.start_data_source_sync_job(
        Id=os.environ["KENDRA_DATA_SOURCE_ID"], IndexId=os.environ["KENDRA_INDEX_ID"]
    )
    logger.info("Sync job started")
    logger.info(response)

    return response


@logger.inject_lambda_context
@tracer.capture_lambda_handler
def handler(event, context: LambdaContext):
    return process_partial_response(
        event=event,
        record_handler=record_handler,
        processor=processor,
        context=context,
    )
