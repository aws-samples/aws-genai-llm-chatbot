from clients.appsync_client import AppSyncClient


def test_list_agents(client: AppSyncClient):
    agents = client.list_agents()
    assert isinstance(agents, list)
