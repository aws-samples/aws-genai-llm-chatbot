from typing import Any
import json
from datetime import datetime

import genai_core.clients
from aws_lambda_powertools import Logger

logger = Logger()


def list_agents() -> list[dict[str, Any]]:
    """
    Get a list of all available agents from Amazon Bedrock

    Returns:
        list[dict[str, Any]]: List of agent information dictionaries
    """
    try:
        client = genai_core.clients.get_bedrock_client(
            service_name="bedrock-agentcore-control"
        )
        response = client.list_agent_runtimes()

        agents = response.get("agentRuntimes", [])
        
        # Convert datetime objects to strings for JSON serialization
        for agent in agents:
            for key, value in agent.items():
                if isinstance(value, datetime):
                    agent[key] = value.isoformat()
        
        return agents
    except Exception as e:
        logger.error(f"Error listing agents: {str(e)}")
        return []
