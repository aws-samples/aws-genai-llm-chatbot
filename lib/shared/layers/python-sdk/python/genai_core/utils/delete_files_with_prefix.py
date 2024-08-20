from aws_lambda_powertools import Logger
import boto3

logger = Logger()


def delete_files_with_prefix(bucket_name, prefix):
    s3_client = boto3.client("s3")
    continuation_token = None

    while True:
        # If we have a continuation token from the previous response, use it
        if continuation_token:
            objects_to_delete = s3_client.list_objects_v2(
                Bucket=bucket_name, Prefix=prefix, ContinuationToken=continuation_token
            )
        else:
            objects_to_delete = s3_client.list_objects_v2(
                Bucket=bucket_name, Prefix=prefix
            )

        # Prepare the list of objects to delete
        if "Contents" in objects_to_delete:
            delete_list = [{"Key": obj["Key"]} for obj in objects_to_delete["Contents"]]

            # Delete the objects in a batch
            s3_client.delete_objects(
                Bucket=bucket_name, Delete={"Objects": delete_list}
            )

        # If there"s no NextContinuationToken in the response, we"ve fetched all objects
        if "NextContinuationToken" in objects_to_delete:
            continuation_token = objects_to_delete["NextContinuationToken"]
        else:
            logger.info("Finished deleting all objects with the specified prefix.")
            break
