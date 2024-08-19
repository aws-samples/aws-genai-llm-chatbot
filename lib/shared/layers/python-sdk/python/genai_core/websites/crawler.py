import re
import os
import uuid
import boto3
import requests
import genai_core.chunks
import genai_core.documents
import pdfplumber
import io
from typing import List
from bs4 import BeautifulSoup
from urllib.parse import urlparse


PROCESSING_BUCKET_NAME = os.environ["PROCESSING_BUCKET_NAME"]
s3 = boto3.resource("s3")


def crawl_urls(
    workspace: dict,
    document: dict,
    priority_queue: List[dict],
    processed_urls: List[str],
    follow_links: bool,
    limit: int,
    content_types: List[str],
):
    workspace_id = workspace["workspace_id"]
    document_id = document["document_id"]
    batch_size = 20

    idx = 0
    while True:
        # break the loop when priority loop is empty or processed urls is equal to limit
        if len(priority_queue) == 0 or len(processed_urls) == limit:
            break

        priority_queue = sorted(priority_queue, key=lambda val: val["priority"])
        current = priority_queue.pop(0)
        current_url = current["url"]
        current_priority = current["priority"]
        if current_url in processed_urls:
            continue

        idx += 1

        document_sub_id = str(uuid.uuid4())
        processed_urls.append(current_url)
        print(f"Processing url {document_sub_id}: {current_url}")

        try:
            content, local_links, _ = parse_url(current_url, content_types)
        except Exception as e:
            print(e)
            print(f"Failed to parse url: {current_url}")
            continue

        _store_content_on_s3(
            workspace_id,
            document_id,
            document_sub_id,
            current_url,
            content,
        )

        chunks = genai_core.chunks.split_content(workspace, content)

        genai_core.chunks.add_chunks(
            replace=False,
            workspace=workspace,
            document=document,
            document_sub_id=document_sub_id,
            chunks=chunks,
            chunk_complements=None,
            path=current_url,
        )
        if follow_links:
            for link in local_links:
                if link not in processed_urls:
                    priority_queue.append(
                        {"url": link, "priority": current_priority + 1}
                    )

        # update the status for every 20 (default batch size) links
        if (
            idx == batch_size
            or len(priority_queue) == 0
            or len(processed_urls) == limit
        ):
            sub_documents = len(processed_urls)
            genai_core.documents.set_sub_documents(
                workspace_id, document_id, sub_documents
            )
            idx = 0

    return {
        "workspace_id": workspace_id,
        "document_id": document_id,
        "workspace": workspace,
        "document": document,
        "priority_queue": priority_queue,
        "processed_urls": processed_urls,
        "follow_links": follow_links,
        "limit": limit,
    }


def parse_url(url: str, content_types_supported: list):
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        + "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
    }

    root_url_parse = urlparse(url)
    base_url = f"{root_url_parse.scheme}://{root_url_parse.netloc}"

    response = requests.get(url, headers=headers, timeout=20)
    content_type = response.headers["Content-Type"]
    links = []

    if ("text/html" in content_type) and ("text/html" in content_types_supported):
        soup = BeautifulSoup(response.content, "html.parser")
        content = soup.get_text(separator=" ")
        content = re.sub(r"[ \n]+", " ", content)
        links = [a["href"] for a in soup.find_all("a", href=True)]

    elif ("application/pdf" in content_type) and (
        "application/pdf" in content_types_supported
    ):
        pdf_bytes = response.content  # Get the bytes content of the response
        pdf_stream = io.BytesIO(pdf_bytes)  # Create a BytesIO stream from the bytes
        with pdfplumber.open(pdf_stream) as pdf:
            content = []
            for page in pdf.pages:
                if page.extract_text():
                    content.append(page.extract_text().replace("\n", " "))

                # Extract links from annotations
                annotations = page.annots
                if annotations:
                    for annot in annotations:
                        if annot["uri"]:
                            links.append(annot["uri"])
            content = " ".join(content)
    else:
        raise Exception(f"Unsupported content type {content_type} found at: {url}")

    local_links = []
    external_links = []

    for idx in range(len(links)):
        link = links[idx]
        lowercase_link = link.lower().strip()
        if lowercase_link.startswith("mailto:"):
            continue

        current = urlparse(link)
        if not current.netloc:
            local_links.append(f"{base_url}{link}")
        else:
            if current.netloc == root_url_parse.netloc:
                local_links.append(link)
            else:
                external_links.append(link)

    local_links = list(set(local_links))
    external_links = list(set(external_links))

    return content, local_links, external_links


def _store_content_on_s3(
    workspace_id: str, document_id: str, document_sub_id: str, path: str, content: str
):
    s3.Object(
        PROCESSING_BUCKET_NAME,
        f"{workspace_id}/{document_id}/{document_sub_id}/path.txt",
    ).put(Body=path)

    s3.Object(
        PROCESSING_BUCKET_NAME,
        f"{workspace_id}/{document_id}/{document_sub_id}/content.txt",
    ).put(Body=content)
