import pytest
from clients.appsync_client import AppSyncClient


def test_ranking(client: AppSyncClient, config):
    enabled = config.get("cross_encoders_enabled")
    if enabled == False:
        pytest.skip("Cross encoders are not enabled")
    result = client.rank_passages(
        {
            "model": "cross-encoder/ms-marco-MiniLM-L-12-v2",
            "provider": "sagemaker",
            "reference": "What is a cat?",
            "passages": ["A cat is an animal.", "A car is a vehicle."],
        }
    )

    assert len(result) == 2
    assert result[0].get("score") > result[1].get("score")
    assert result[0].get("passage") == "A cat is an animal."
