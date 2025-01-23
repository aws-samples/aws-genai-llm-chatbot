from clients.appsync_client import AppSyncClient


def test_list_roles(client: AppSyncClient):
    roles = client.list_roles()
    assert len(roles) > 1
    role = next(i for i in roles if i.get("name") == "admin")
    assert role == {
        "id": "admin",
        "name": "admin",
    }
