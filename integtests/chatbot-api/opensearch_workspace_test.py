import pytest
from clients.appsync_client import AppSyncClient


@pytest.fixture(autouse=True)
def run_before_and_after_tests(client: AppSyncClient):
    rag_engines = client.list_rag_engines()
    engine = next(i for i in rag_engines if i.get("id") == "opensearch")
    if engine.get("enabled") == False:
        pytest.skip("Open search is not enabled.", allow_module_level=True)
        
    for workspace in client.list_workspaces():
        if workspace.get("name") == "INTEG_TEST_OPEN_SEARCH":
            client.delete_workspace(workspace.get("id"))
    

def test_create(client: AppSyncClient, default_embed_model):
    client.create_opensearch_workspace(
        input={
            "kind": "aoss",
            "name": "INTEG_TEST_OPEN_SEARCH",
            "embeddingsModelProvider": "bedrock",
            "embeddingsModelName": default_embed_model,
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
