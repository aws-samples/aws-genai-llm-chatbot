from typing import Any
from datetime import datetime

import genai_core.clients
from aws_lambda_powertools import Logger
from botocore.exceptions import ClientError, BotoCoreError

logger = Logger()


def list_agents() -> list[dict[str, Any]]:
    """
    Get a list of all available agents from Amazon Bedrock

    Returns:
        list[dict[str, Any]]: List of agent information dictionaries
    """
    try:
        client = genai_core.clients.get_agentcore_control_client()
        response = client.list_agent_runtimes()

        agents = response.get("agentRuntimes", [])

        # Convert datetime objects to strings for JSON serialization
        for agent in agents:
            for key, value in agent.items():
                if isinstance(value, datetime):
                    agent[key] = value.isoformat()

        return agents
    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code", "Unknown")
        logger.error(f"AWS client error listing agents: {error_code} - {str(e)}")
        return []
    except BotoCoreError as e:
        logger.error(f"AWS service error listing agents: {str(e)}")
        return []
    except (KeyError, AttributeError) as e:
        logger.error(f"Data structure error listing agents: {str(e)}")
        return []
    except Exception as e:
        logger.error(f"Unexpected error listing agents: {type(e).__name__} - {str(e)}")
        return []
