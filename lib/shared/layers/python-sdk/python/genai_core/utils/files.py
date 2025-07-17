import boto3
from botocore.config import Config
import os

s3 = boto3.client("s3", region_name = os.environ['AWS_REGION'], config = Config(signature_version = 's3v4'))


def file_exists(bucket, key):
    try:
        s3.head_object(Bucket=bucket, Key=key)
        return True
    except boto3.exceptions.botocore.exceptions.ClientError as e:
        # If a client error is thrown, then check that it was a 404 error.
        # If it was a 404 error, then the file doesn't exist.
        error_code = int(e.response["Error"]["Code"])
        if error_code == 404:
            return False
        else:
            raise
