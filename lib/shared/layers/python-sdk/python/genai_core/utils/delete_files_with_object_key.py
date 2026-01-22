from aws_lambda_powertools import Logger
import boto3
from botocore.config import Config
import os

logger = Logger()


def delete_files_with_object_key(bucket_name, object_key):
    s3_client = boto3.client("s3", region_name = os.environ['AWS_REGION'], config = Config(signature_version = 's3v4'))
    s3_client.delete_object(Bucket=bucket_name, Key=object_key)
    logger.info(f"Deleted {object_key} from {bucket_name}.")
