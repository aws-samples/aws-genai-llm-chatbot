from clients.appsync_client import AppSyncClient


def test_list_models(client: AppSyncClient, default_model):
    models = client.list_models()
    assert len(models) > 10
    model = next(i for i in models if i.get("name") == default_model)
    assert model == {
        "name": "anthropic.claude-3-haiku-20240307-v1:0",
        "provider": "bedrock",
        "interface": "langchain",
        "ragSupported": True,
        "inputModalities": ["TEXT", "IMAGE", "DOCUMENT"],
        "outputModalities": ["TEXT"],
        "streaming": True,
    }
