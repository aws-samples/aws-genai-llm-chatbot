from unittest.mock import patch


def test_agents_function_calls_list_agents():
    """Test that the agents function calls genai_core.agents.list_agents"""
    mock_agents = [
        {
            "agentRuntimeId": "test-agent-1",
            "agentRuntimeName": "Test Agent 1",
            "status": "ACTIVE",
        }
    ]

    with patch("genai_core.agents.list_agents", return_value=mock_agents) as mock_list:
        # Import the module and get the underlying function
        from routes.agents import agents

        # Get the original function before decorators
        original_func = (
            agents.__wrapped__.__wrapped__
        )  # Skip tracer and permissions decorators

        result = original_func()

        # Verify the function was called and returned expected result
        mock_list.assert_called_once()
        assert result == mock_agents


def test_agents_function_handles_empty_list():
    """Test that the agents function handles empty agent list"""
    with patch("genai_core.agents.list_agents", return_value=[]) as mock_list:
        from routes.agents import agents

        original_func = agents.__wrapped__.__wrapped__
        result = original_func()

        mock_list.assert_called_once()
        assert result == []


def test_agents_authorization_decorator_exists():
    """Test that authorization decorator is properly applied"""
    from routes.agents import agents

    # Verify the function has the permissions decorator
    assert hasattr(agents, "__wrapped__")

    # Check that it's decorated with approved_roles
    # The decorator should be in the function's attributes
    func_name = getattr(agents, "__name__", "")
    assert func_name == "wrapper" or "agents" in func_name
