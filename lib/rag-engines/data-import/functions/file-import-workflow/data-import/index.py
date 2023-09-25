import boto3
import genai_core.types
import genai_core.chunks
import genai_core.documents
import genai_core.workspaces
import genai_core.aurora.create
from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.typing import LambdaContext

logger = Logger()

s3 = boto3.resource("s3")


@logger.inject_lambda_context(log_event=True)
def lambda_handler(event, context: LambdaContext):
    workspace_id = event["workspace_id"]
    document_id = event["document_id"]

    logger.info(f"Processing document {workspace_id}/{document_id}")

    workspace = genai_core.workspaces.get_workspace(workspace_id)
    if not workspace:
        raise genai_core.types.CommonError(f"Workspace {workspace_id} does not exist")

    document = genai_core.documents.get_document(workspace_id, document_id)
    if not document:
        raise genai_core.types.CommonError(
            f"Document {workspace_id}/{document_id} does not exist"
        )

    result = genai_core.documents.get_document_content(workspace_id, document_id)
    if not result:
        raise genai_core.types.CommonError(
            f"Document {workspace_id}/{document_id} has no content"
        )

    content = result["content"]
    logger.info(f"Document {workspace_id}/{document_id} content: {content}")

    chunks = genai_core.chunks.split_content(workspace, content)
    logger.info(f"Document {workspace_id}/{document_id} chunks: {chunks}")

    genai_core.chunks.add_chunks(
        workspace=workspace,
        document=document,
        document_sub_id=None,
        chunks=chunks,
        chunk_complements=None,
        replace=True,
    )

    return {"ok": True}
