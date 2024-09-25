from clients.appsync_client import AppSyncClient


def test_calculate(client: AppSyncClient, default_embed_model, default_provider):
    result = client.calculate_embeding(
        {
            "model": default_embed_model,
            "provider": default_provider,
            "task": "store",
            "passages": ["The dog chases the ball"],
        }
    )

    assert len(result) == 1
    assert len(result[0].get("vector")) == 1536
