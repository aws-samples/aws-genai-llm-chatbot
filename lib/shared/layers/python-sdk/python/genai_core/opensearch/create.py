from aws_lambda_powertools import Logger
from .client import get_open_search_client

logger = Logger()


def create_workspace_index(workspace: dict):
    workspace_id = workspace["workspace_id"]
    index_name = workspace_id.replace("-", "")
    embeddings_model_dimensions = workspace["embeddings_model_dimensions"]

    client = get_open_search_client()

    ef_search = 512
    index_body = {
        "settings": {
            "index": {
                "knn": True,
                "knn.algo_param.ef_search": ef_search,
            }
        },
        "mappings": {
            "properties": {
                "content_embeddings": {
                    "type": "knn_vector",
                    "dimension": int(embeddings_model_dimensions),
                    "method": {
                        "name": "hnsw",
                        "space_type": "l2",
                        "engine": "nmslib",
                        "parameters": {"ef_construction": 512, "m": 16},
                    },
                },
                "chunk_id": {"type": "keyword"},
                "workspace_id": {"type": "keyword"},
                "document_id": {"type": "keyword"},
                "document_sub_id": {"type": "keyword"},
                "document_type": {"type": "keyword"},
                "document_sub_type": {"type": "keyword"},
                "path": {"type": "text"},
                "language": {"type": "keyword"},
                "title": {"type": "text"},
                "content": {"type": "text"},
                "content_complement": {"type": "text"},
                "metadata": {"type": "object"},
                "created_at": {
                    "type": "date",
                    "format": "yyyy-MM-dd HH:mm:ss||yyyy-MM-dd||epoch_millis",
                },
            }
        },
    }

    response = client.indices.create(index_name, body=index_body)

    logger.info("Response for create_workspace_index", response=response)
