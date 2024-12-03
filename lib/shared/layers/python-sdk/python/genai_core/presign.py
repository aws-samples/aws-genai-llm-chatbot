import os
import boto3
import botocore
import botocore.config
import genai_core.workspaces
import genai_core.types
import unicodedata

UPLOAD_BUCKET_NAME = os.environ.get("UPLOAD_BUCKET_NAME")
CHATBOT_FILES_BUCKET_NAME = os.environ.get("CHATBOT_FILES_BUCKET_NAME")
MAX_FILE_SIZE = 10 * 1000 * 1000  # 10Mb

s3_client = boto3.client(
    "s3",
    config=botocore.config.Config(
        # Presign URLs only work with CMK if sigv4 is used
        # (boto3 default to v2 in some cases)
        signature_version="s3v4",
    ),
)


def generate_workspace_presigned_post(
    workspace_id: str, file_name: str, expiration=3600
):
    file_name = unicodedata.normalize("NFC", file_name)
    workspace = genai_core.workspaces.get_workspace(workspace_id)
    if not workspace:
        raise genai_core.types.CommonError("Workspace not found")

    file_name = os.path.basename(file_name)
    object_name = f"{workspace_id}/{file_name}"

    conditions = [
        ["content-length-range", 0, MAX_FILE_SIZE],
    ]

    response = s3_client.generate_presigned_post(
        UPLOAD_BUCKET_NAME, object_name, Conditions=conditions, ExpiresIn=expiration
    )

    if not response:
        return None

    response["url"] = f"https://{UPLOAD_BUCKET_NAME}.s3-accelerate.amazonaws.com"

    return response


def generate_user_presigned_post(user_id: str, file_name: str, expiration=3600):
    file_name = unicodedata.normalize("NFC", file_name)
    if not user_id or len(user_id) < 10:
        raise genai_core.types.CommonError("User not set")

    file_name = os.path.basename(file_name)
    object_name = f"private/{user_id}/{file_name}"

    conditions = [
        ["content-length-range", 0, MAX_FILE_SIZE],
    ]

    response = s3_client.generate_presigned_post(
        CHATBOT_FILES_BUCKET_NAME,
        object_name,
        Conditions=conditions,
        ExpiresIn=expiration,
    )

    if not response:
        return None

    response["url"] = f"https://{CHATBOT_FILES_BUCKET_NAME}.s3-accelerate.amazonaws.com"

    return response


def generate_user_presigned_get(user_id: str, file_name: str, expiration=3600):
    file_name = unicodedata.normalize("NFC", file_name)
    if not user_id or len(user_id) < 10:
        raise genai_core.types.CommonError("User not set")

    object_name = f"private/{user_id}/{file_name}"
    try:
        s3_client.head_object(Bucket=CHATBOT_FILES_BUCKET_NAME, Key=object_name)
    except botocore.exceptions.ClientError as e:
        if e.response["Error"]["Code"] == "404":
            raise genai_core.types.CommonError("File does not exist")
        else:
            raise e
    response = s3_client.generate_presigned_url(
        "get_object",
        Params={"Bucket": CHATBOT_FILES_BUCKET_NAME, "Key": object_name},
        ExpiresIn=expiration,
    )

    if not response:
        return None
    return response
