import os
import boto3
from langchain.document_loaders import S3FileLoader

WORKSPACE_ID = os.environ.get("WORKSPACE_ID")
DOCUMENT_ID = os.environ.get("DOCUMENT_ID")
INPUT_BUCKET_NAME = os.environ.get("INPUT_BUCKET_NAME")
INPUT_OBJECT_KEY = os.environ.get("INPUT_OBJECT_KEY")
PROCESSING_BUCKET_NAME = os.environ.get("PROCESSING_BUCKET_NAME")
PROCESSING_OBJECT_KEY = os.environ.get("PROCESSING_OBJECT_KEY")

s3 = boto3.client("s3")


def main():
    print("Starting file converter batch job")
    print("Workspace ID: {}".format(WORKSPACE_ID))
    print("Document ID: {}".format(DOCUMENT_ID))
    print("Input bucket name: {}".format(INPUT_BUCKET_NAME))
    print("Input object key: {}".format(INPUT_OBJECT_KEY))
    print("Output bucket name: {}".format(PROCESSING_BUCKET_NAME))
    print("Output object key: {}".format(PROCESSING_OBJECT_KEY))

    loader = S3FileLoader(INPUT_BUCKET_NAME, INPUT_OBJECT_KEY)
    print(f"loader: {loader}")
    docs = loader.load()

    page_content = docs[0].page_content
    s3.put_object(
        Bucket=PROCESSING_BUCKET_NAME, Key=PROCESSING_OBJECT_KEY, Body=page_content
    )


if __name__ == "__main__":
    main()
