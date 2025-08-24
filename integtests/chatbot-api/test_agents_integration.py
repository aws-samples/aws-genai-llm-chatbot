from clients.appsync_client import AppSyncClient
import pytest


def test_list_agents_admin_access(client: AppSyncClient):
    """Test admin can list agents"""
    agents = client.list_agents()
    assert isinstance(agents, list)


def test_list_agents_workspace_manager_access(client_workspace_manager: AppSyncClient):
    """Test workspace manager can list agents"""
    agents = client_workspace_manager.list_agents()
    assert isinstance(agents, list)


def test_list_agents_user_unauthorized(client_user: AppSyncClient):
    """Test regular user cannot list agents"""
    with pytest.raises(Exception) as exc_info:
        client_user.list_agents()
    assert "Unauthorized" in str(exc_info.value)


def test_agent_schema_validation(client: AppSyncClient):
    """Test agent response has required fields"""
    agents = client.list_agents()
    if agents:  # Only test if agents exist
        agent = agents[0]
        required_fields = ["agentRuntimeId", "agentRuntimeName", "status"]
        for field in required_fields:
            assert field in agent
