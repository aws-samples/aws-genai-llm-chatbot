import boto3

def delete_files_with_object_key (bucket_name, object_key):
    s3_client = boto3.client("s3")
    s3_client.delete_object(Bucket=bucket_name, Key=object_key)
    print(f"Deleted {object_key} from {bucket_name}.")
