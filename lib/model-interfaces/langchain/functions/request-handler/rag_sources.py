import os

import boto3


def list_rag_sources():
    rag_sources = []

    # get all the rag sources from the environment variables that start with RAG_SOURCE_
    for key, value in os.environ.items():
        if key.startswith("RAG_SOURCE_"):
            source = key.replace("RAG_SOURCE_", "")
            rag_sources.append(
                {
                    "label": source,
                    "value": source,
                }
            )

    return rag_sources
