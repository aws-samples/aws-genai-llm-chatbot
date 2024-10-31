import os
import uuid
import boto3
import genai_core.documents
import genai_core.embeddings
import genai_core.aurora.chunks
import genai_core.opensearch.chunks
from genai_core.types import CommonError, Task
from typing import List, Optional
from langchain_text_splitters import RecursiveCharacterTextSplitter

PROCESSING_BUCKET_NAME = os.environ.get("PROCESSING_BUCKET_NAME", "")
s3 = boto3.resource("s3")


def add_chunks(
    replace: bool,
    workspace: dict,
    document: dict,
    document_sub_id: Optional[str],
    chunks: List[str],
    chunk_complements: List[str],
    path: Optional[str] = None,
):
    workspace_id = workspace["workspace_id"]
    engine = workspace["engine"]
    embeddings_model_provider = workspace["embeddings_model_provider"]
    embeddings_model_name = workspace["embeddings_model_name"]
    document_id = document["document_id"]
    document_type = document["document_type"]
    document_sub_type = document["document_sub_type"]
    path = path if path else document["path"]
    title = document["title"]

    embeddings_model = genai_core.embeddings.get_embeddings_model(
        embeddings_model_provider, embeddings_model_name
    )

    if embeddings_model is None:
        raise CommonError("Embeddings model not found")

    chunk_embeddings = genai_core.embeddings.generate_embeddings(
        embeddings_model, chunks, Task.STORE.value
    )
    chunk_ids = [uuid.uuid4() for _ in chunks]

    store_chunks_on_s3(workspace_id, document_id, document_sub_id, chunk_ids, chunks)

    if engine == "aurora":
        result = genai_core.aurora.chunks.add_chunks_aurora(
            workspace_id=workspace_id,
            document_id=document_id,
            document_sub_id=document_sub_id,
            document_type=document_type,
            document_sub_type=document_sub_type,
            path=path,
            title=title,
            chunk_ids=chunk_ids,
            chunk_embeddings=chunk_embeddings,
            chunks=chunks,
            chunk_complements=chunk_complements,
            replace=replace,
        )
    elif engine == "opensearch":
        result = genai_core.opensearch.chunks.add_chunks_open_search(
            workspace_id=workspace_id,
            document_id=document_id,
            document_sub_id=document_sub_id,
            document_type=document_type,
            document_sub_type=document_sub_type,
            path=path,
            title=title,
            chunk_ids=chunk_ids,
            chunk_embeddings=chunk_embeddings,
            chunks=chunks,
            chunk_complements=chunk_complements,
            replace=replace,
        )
    else:
        raise CommonError("Engine not supported")

    added_vectors = result["added_vectors"]
    genai_core.documents.set_document_vectors(
        workspace_id, document_id, added_vectors, replace=replace
    )


def split_content(workspace: dict, content: str):
    chunking_strategy = workspace["chunking_strategy"]
    chunk_size = workspace["chunk_size"]
    chunk_overlap = workspace["chunk_overlap"]

    if chunking_strategy == "recursive":
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size, chunk_overlap=chunk_overlap, length_function=len
        )

        text_data = text_splitter.split_text(content)
        text_data = [text.replace("\x00", "\uFFFD") for text in text_data]

        return text_data

    raise CommonError("Chunking strategy not supported")


def store_chunks_on_s3(
    workspace_id: str,
    document_id: str,
    document_sub_id: Optional[str],
    chunk_ids: List[str],
    chunks: List[str],
):
    for chunk_id, chunk in zip(chunk_ids, chunks):
        path = f"{workspace_id}/{document_id}/chunks/{chunk_id}.txt"
        if document_sub_id:
            path = (
                f"{workspace_id}/{document_id}/{document_sub_id}/chunks/{chunk_id}.txt"
            )

        s3.Object(PROCESSING_BUCKET_NAME, path).put(Body=chunk)
