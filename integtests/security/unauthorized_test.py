import pytest
from gql.transport.exceptions import TransportQueryError
from clients.appsync_client import AppSyncClient


def test_unauthenticated(unauthenticated_client: AppSyncClient):
    match = "UnauthorizedException"
    with pytest.raises(TransportQueryError, match=match):
        unauthenticated_client.send_query("")
    with pytest.raises(TransportQueryError, match=match):
        unauthenticated_client.get_session("id")
    with pytest.raises(TransportQueryError, match=match):
        unauthenticated_client.list_sessions()
    with pytest.raises(TransportQueryError, match=match):
        unauthenticated_client.delete_session("id")
    with pytest.raises(TransportQueryError, match=match):
        unauthenticated_client.list_models()
    with pytest.raises(TransportQueryError, match=match):
        unauthenticated_client.list_rag_engines()
    with pytest.raises(TransportQueryError, match=match):
        unauthenticated_client.delete_user_sessions()
    with pytest.raises(TransportQueryError, match=match):
        unauthenticated_client.create_aurora_workspace(
            input={
                "kind": "aoss",
                "name": "INTEG_TEST_OPEN_SEARCH",
                "embeddingsModelProvider": "bedrock",
                "embeddingsModelName": "model",
                "crossEncoderModelName": "cross-encoder/ms-marco-MiniLM-L-12-v2",
                "crossEncoderModelProvider": "sagemaker",
                "languages": ["english"],
                "index": True,
                "hybridSearch": False,
                "chunkingStrategy": "recursive",
                "chunkSize": 1000,
                "chunkOverlap": 200,
                "metric": "value",
            }
        )
    with pytest.raises(TransportQueryError, match=match):
        unauthenticated_client.list_workspaces()
    with pytest.raises(TransportQueryError, match=match):
        unauthenticated_client.get_workspace("id")
    with pytest.raises(TransportQueryError, match=match):
        unauthenticated_client.delete_workspace("id")
    with pytest.raises(TransportQueryError, match=match):
        unauthenticated_client.add_text(
            input={
                "workspaceId": "id",
                "title": "INTEG_TEST_OPEN_SEARCH_TITLE",
                "content": "The Integ Test flower is green.",
            }
        )
    with pytest.raises(TransportQueryError, match=match):
        unauthenticated_client.add_rss_feed(
            input={
                "workspaceId": "id",
                "title": "INTEG_TEST_OPEN_SEARCH_TITLE",
                "content": "The Integ Test flower is green.",
                "address": "address",
                "limit": 1,
                "followLinks": True,
                "contentTypes": ["type"],
            }
        )
    with pytest.raises(TransportQueryError, match=match):
        unauthenticated_client.get_document(
            input={
                "workspaceId": "id",
                "documentId": "id",
            }
        )
    with pytest.raises(TransportQueryError, match=match):
        unauthenticated_client.get_rss_posts(
            input={
                "workspaceId": "id",
                "documentId": "id",
            }
        )
    with pytest.raises(TransportQueryError, match=match):
        unauthenticated_client.semantic_search(input={"workspaceId": "id", "query": ""})
    with pytest.raises(TransportQueryError, match=match):
        unauthenticated_client.delete_document(
            input={
                "workspaceId": "id",
                "documentId": "id",
            }
        )
    with pytest.raises(TransportQueryError, match=match):
        unauthenticated_client.calculate_embeding(
            input={
                "model": "id",
                "provider": "id",
                "task": "store",
                "passages": [],
            }
        )
    with pytest.raises(TransportQueryError, match=match):
        unauthenticated_client.rank_passages(
            input={
                "model": "cross-encoder/ms-marco-MiniLM-L-12-v2",
                "provider": "sagemaker",
                "reference": "What is a cat?",
                "passages": ["A cat is an animal.", "A car is a vehicle."],
            }
        )

    with pytest.raises(TransportQueryError, match=match):
        unauthenticated_client.create_opensearch_workspace(
            input={
                "kind": "aoss",
                "name": "INTEG_TEST_OPEN_SEARCH",
                "embeddingsModelProvider": "bedrock",
                "embeddingsModelName": "model",
                "crossEncoderModelName": "cross-encoder/ms-marco-MiniLM-L-12-v2",
                "crossEncoderModelProvider": "sagemaker",
                "languages": ["english"],
                "index": True,
                "hybridSearch": False,
                "chunkingStrategy": "recursive",
                "chunkSize": 1000,
                "chunkOverlap": 200,
            }
        )
    with pytest.raises(TransportQueryError, match=match):
        unauthenticated_client.start_kendra_data_sync("id")
    with pytest.raises(TransportQueryError, match=match):
        unauthenticated_client.is_kendra_data_synching("id")
    with pytest.raises(TransportQueryError, match=match):
        unauthenticated_client.get_file_url("file")
    with pytest.raises(TransportQueryError, match=match):
        unauthenticated_client.list_kendra_indexes()
    with pytest.raises(TransportQueryError, match=match):
        unauthenticated_client.list_documents(
            input={
                "workspaceId": "id",
                "documentType": "file",
            }
        )
    with pytest.raises(TransportQueryError, match=match):
        unauthenticated_client.add_file(
            input={
                "workspaceId": "id",
                "fileName": "file.txt",
            }
        )
    with pytest.raises(TransportQueryError, match=match):
        unauthenticated_client.create_kendra_workspace(
            input={
                "name": "workspace1",
                "kind": "kendra",
                "kendraIndexId": "kendra-id-1",
                "useAllData": True,
            }
        )
