import re
import uuid
import requests
import genai_core.chunks
import genai_core.documents
from typing import List
from bs4 import BeautifulSoup
from urllib.parse import urlparse
from aws_lambda_powertools import Logger

logger = Logger()


def crawl_urls(workspace: dict, document: dict, urls_to_crawl: List[str], limit: int, follow_links: bool):
    urls = list(set(urls_to_crawl))
    processed_urls = []

    for _ in range(limit):
        if len(urls) == 0:
            break

        current_url = urls.pop(0)
        processed_urls.append(current_url)
        document_sub_id = str(uuid.uuid4())

        logger.info(f"Processing url {document_sub_id}: {current_url}")

        try:
            content, local_links, _ = parse_url(current_url)
        except:
            logger.error(f"Failed to parse url: {current_url}")
            continue

        chunks = genai_core.chunks.split_content(workspace, content)
        genai_core.chunks.add_chunks(replace=False, workspace=workspace,
                                     document=document, document_sub_id=document_sub_id,
                                     chunks=chunks, chunk_complements=None,
                                     path=current_url)
        if follow_links:
            for link in local_links:
                if link not in urls and link not in processed_urls:
                    urls.append(link)

    processed_urls = list(set(processed_urls))
    sub_documents = len(processed_urls)
    genai_core.documents.set_sub_documents(
        workspace["workspace_id"], document["document_id"], sub_documents)

    return processed_urls


def parse_url(url: str):
    root_url_parse = urlparse(url)
    base_url = f"{root_url_parse.scheme}://{root_url_parse.netloc}"

    response = requests.get(url, timeout=20)
    soup = BeautifulSoup(response.content, "html.parser")
    content = soup.text
    content = re.sub(r"[ \n]+", " ", content)

    links = list(set([a["href"] for a in soup.find_all("a", href=True)]))
    local_links = []
    external_links = []

    for idx in range(len(links)):
        link = links[idx]
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
