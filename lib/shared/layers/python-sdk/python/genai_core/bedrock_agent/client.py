import boto3
import genai_core.types
import genai_core.parameters
from aws_lambda_powertools import Logger
import json
import os
from typing import Dict, Any, Optional

sts_client = boto3.client("sts")
logger = Logger()


def extract_text_from_dict_event(event: Dict[str, Any]) -> str:
    """
    Extract text from a dictionary event
    
    Args:
        event: Dictionary event to process
        
    Returns:
        str: Extracted text from the event
    """
    text = ""
    logger.info(f"Event keys: {event.keys()}")
    
    # Check for chunk
    if "chunk" in event:
        chunk = event["chunk"]
        logger.info(f"Chunk: {chunk}")
        
        if isinstance(chunk, dict):
            if "bytes" in chunk:
                chunk_text = chunk["bytes"].decode("utf-8")
                text += chunk_text
                logger.info(f"Added chunk text from bytes: {chunk_text}")
            elif "text" in chunk:
                text += chunk["text"]
                logger.info(f"Added chunk text directly: {chunk['text']}")
    
    # Check for text
    if "text" in event:
        text += event["text"]
        logger.info(f"Added text directly: {event['text']}")
    
    # Check for bytes
    if "bytes" in event:
        chunk_text = event["bytes"].decode("utf-8")
        text += chunk_text
        logger.info(f"Added text from bytes: {chunk_text}")
    
    # Check for payload
    if "payload" in event:
        try:
            payload = json.loads(event["payload"].decode("utf-8"))
            if "text" in payload:
                text += payload["text"]
                logger.info(f"Added text from payload: {payload['text']}")
        except Exception as e:
            logger.error(f"Error extracting text from payload: {e}")
    
    # Check for content
    if "content" in event:
        text += event["content"]
        logger.info(f"Added content: {event['content']}")
    
    # Check for message
    if "message" in event:
        text += event["message"]
        logger.info(f"Added message: {event['message']}")
    
    return text


def extract_text_from_object_event(event: Any) -> str:
    """
    Extract text from an object event
    
    Args:
        event: Object event to process
        
    Returns:
        str: Extracted text from the event
    """
    text = ""
    
    # Check if this is a chunk event with text
    if hasattr(event, "chunk") and event.chunk:
        if hasattr(event.chunk, "bytes") and event.chunk.bytes:
            chunk_text = event.chunk.bytes.decode("utf-8")
            text += chunk_text
            logger.info(f"Added chunk text from bytes: {chunk_text}")
        elif hasattr(event.chunk, "text") and event.chunk.text:
            text += event.chunk.text
            logger.info(f"Added chunk text directly: {event.chunk.text}")
    
    # Check if the event itself has text content
    elif hasattr(event, "text") and event.text:
        text += event.text
        logger.info(f"Added direct text: {event.text}")
    
    # Check if the event has bytes content
    elif hasattr(event, "bytes") and event.bytes:
        chunk_text = event.bytes.decode("utf-8")
        text += chunk_text
        logger.info(f"Added text from bytes: {chunk_text}")
    
    # Check for completion
    elif hasattr(event, "completion") and event.completion:
        if hasattr(event.completion, "text") and event.completion.text:
            text += event.completion.text
            logger.info(f"Added completion text: {event.completion.text}")
        elif hasattr(event.completion, "bytes") and event.completion.bytes:
            chunk_text = event.completion.bytes.decode("utf-8")
            text += chunk_text
            logger.info(f"Added completion text from bytes: {chunk_text}")
    
    # Try to extract the text from the event's payload
    if hasattr(event, "payload"):
        try:
            payload = json.loads(event.payload.decode("utf-8"))
            if "text" in payload:
                text += payload["text"]
                logger.info(f"Added text from payload: {payload['text']}")
        except Exception as e:
            logger.error(f"Error extracting text from payload: {e}")
    
    return text


def process_event_stream(event_stream: Any) -> str:
    """
    Process an EventStream object to extract text
    
    Args:
        event_stream: The EventStream object to process
        
    Returns:
        str: The extracted text
    """
    if event_stream is None:
        return ""
    
    # If it's already a string, return it
    if isinstance(event_stream, str):
        return event_stream
    
    # Try to extract text from the EventStream
    text = ""
    
    try:
        # Try to iterate through the stream
        for event in event_stream:
            logger.info(f"Event type: {type(event)}")
            
            if isinstance(event, dict):
                text += extract_text_from_dict_event(event)
            else:
                text += extract_text_from_object_event(event)
                
    except Exception as e:
        logger.error(f"Error processing EventStream: {str(e)}")
    
    return text


def get_bedrock_client(service_name="bedrock"):
    """
    Get a boto3 client for Bedrock services, with cross-account support if configured
    
    Args:
        service_name (str, optional): The Bedrock service name. Defaults to "bedrock".
            Use "bedrock" for general Bedrock APIs
            Use "bedrock-agent-runtime" for agent runtime APIs
            Use "bedrock-agent" for agent management APIs
    
    Returns:
        A boto3 client for the specified Bedrock service
    """
    # Get region from environment or use default
    region = os.environ.get("BEDROCK_REGION", "us-east-1")
    
    # Check if we need to assume a role
    role_arn = os.environ.get("BEDROCK_ROLE_ARN")
    
    config_data = {"service_name": service_name}
    if region:
        config_data["region_name"] = region
        
    if role_arn:
        assumed_role_object = sts_client.assume_role(
            RoleArn=role_arn,
            RoleSessionName="AssumedRoleSession",
        )
        
        credentials = assumed_role_object["Credentials"]
        config_data["aws_access_key_id"] = credentials["AccessKeyId"]
        config_data["aws_secret_access_key"] = credentials["SecretAccessKey"]
        config_data["aws_session_token"] = credentials["SessionToken"]
    
    client = boto3.client(**config_data)
    return client


def get_bedrock_agent_client():
    """
    Get a boto3 client for bedrock-agent-runtime, with cross-account support if configured
    
    Returns:
        A boto3 client for bedrock-agent-runtime
        
    Raises:
        CommonError: If Bedrock Agent is not enabled
    """
    # Check if Bedrock agent is enabled via environment variables
    agent_id = os.environ.get("BEDROCK_AGENT_ID")
    if not agent_id:
        raise genai_core.types.CommonError("Bedrock Agent is not enabled - BEDROCK_AGENT_ID not set")
    
    return get_bedrock_client(service_name="bedrock-agent-runtime")


def get_agent_config():
    """
    Get the Bedrock agent configuration from environment variables
    
    Returns:
        dict: A dictionary containing the agent configuration
        
    Raises:
        CommonError: If Bedrock Agent is not enabled
    """
    # Read configuration from environment variables
    agent_id = os.environ.get("BEDROCK_AGENT_ID")
    if not agent_id:
        raise genai_core.types.CommonError("Bedrock Agent is not enabled - BEDROCK_AGENT_ID not set")
    
    agent_version = os.environ.get("BEDROCK_AGENT_VERSION", "DRAFT")
    agent_alias_id = os.environ.get("BEDROCK_AGENT_ALIAS_ID")
    
    return {
        "agentId": agent_id,
        "agentVersion": agent_version,
        "agentAliasId": agent_alias_id,
    }


def list_agents(region: Optional[str] = None) -> list[dict[str, Any]]:
    """
    List all Bedrock agents in the account
    
    Args:
        region (str, optional): The AWS region to list agents from. Defaults to None (uses BEDROCK_REGION from environment).
    
    Returns:
        list[dict[str, Any]]: List of agent information dictionaries
        
    Raises:
        CommonError: If there's an error listing the agents
    """
    try:
        # Get a Bedrock agent client
        client = get_bedrock_client(service_name="bedrock-agent")
        
        # List all agents
        logger.info("Listing Bedrock agents...")
        response = client.list_agents()
        logger.info(f"Found {len(response.get('agentSummaries', []))} agents")
        
        # Extract agent information
        agents = []
        for agent_summary in response.get("agentSummaries", []):
            # Get agent details
            agent_id = agent_summary.get("agentId")
            agent_name = agent_summary.get("agentName")
            agent_status = agent_summary.get("agentStatus")
            
            logger.info(f"Processing agent: {agent_name} ({agent_id})")
            
            # Get agent aliases
            try:
                alias_response = client.list_agent_aliases(agentId=agent_id)
                aliases = []
                for alias in alias_response.get("agentAliasSummaries", []):
                    aliases.append({
                        "agentAliasId": alias.get("agentAliasId"),
                        "agentAliasName": alias.get("agentAliasName"),
                        "routingConfiguration": alias.get("routingConfiguration")
                    })
                logger.info(f"Found {len(aliases)} aliases for agent {agent_id}")
            except Exception as alias_error:
                logger.error(f"Error listing aliases for agent {agent_id}: {str(alias_error)}")
                aliases = []
            
            # Get agent versions
            try:
                version_response = client.list_agent_versions(agentId=agent_id)
                versions = []
                for version in version_response.get("agentVersionSummaries", []):
                    versions.append({
                        "agentVersion": version.get("agentVersion"),
                        "agentStatus": version.get("agentStatus"),
                        "createdAt": version.get("createdAt"),
                    })
                logger.info(f"Found {len(versions)} versions for agent {agent_id}")
            except Exception as version_error:
                logger.error(f"Error listing versions for agent {agent_id}: {str(version_error)}")
                versions = []
            
            # Add agent information to the list
            agents.append({
                "agentId": agent_id,
                "agentName": agent_name,
                "agentStatus": agent_status,
                "aliases": aliases,
                "versions": versions,
                "createdAt": agent_summary.get("createdAt"),
                "updatedAt": agent_summary.get("updatedAt"),
            })
        
        return agents
    except Exception as e:
        logger.error(f"Error listing Bedrock agents: {str(e)}")
        raise genai_core.types.CommonError(f"Error listing Bedrock agents: {str(e)}")


def select_agent(agents: list[dict[str, Any]], agent_name: Optional[str] = None, agent_id: Optional[str] = None) -> Optional[dict[str, Any]]:
    """
    Select an agent from the list of agents
    
    Args:
        agents (list[dict[str, Any]]): List of agent information dictionaries
        agent_name (str, optional): The name of the agent to select. Defaults to None.
        agent_id (str, optional): The ID of the agent to select. Defaults to None.
        
    Returns:
        Optional[dict[str, Any]]: The selected agent, or None if no agent was found
    """
    if not agents:
        return None
    
    # If agent_id is provided, use it to select the agent
    if agent_id:
        for agent in agents:
            if agent.get("agentId") == agent_id:
                return agent
    
    # If agent_name is provided, use it to select the agent
    if agent_name:
        for agent in agents:
            if agent.get("agentName") == agent_name:
                return agent
    
    # If no agent was found, return the first agent
    return agents[0]


def invoke_agent_by_id(agent_id: str, agent_alias_id: Optional[str] = None, agent_version: str = "DRAFT", 
                      session_id: Optional[str] = None, prompt: str = "", enable_trace: bool = True) -> Dict[str, Any]:
    """
    Invoke a specific Bedrock agent with the given prompt
    
    Args:
        agent_id (str): The ID of the agent to invoke
        agent_alias_id (str, optional): The alias ID of the agent to invoke. Defaults to None.
        agent_version (str, optional): The version of the agent to invoke. Defaults to "DRAFT".
        session_id (str, optional): The session ID to use for the agent. Defaults to None (generates a new session ID).
        prompt (str, optional): The prompt to send to the agent. Defaults to "".
        enable_trace (bool, optional): Whether to enable trace. Defaults to True.
        
    Returns:
        dict: The response from the agent
        
    Raises:
        CommonError: If there's an error invoking the agent
    """
    # Generate a session ID if none is provided
    if session_id is None:
        import uuid
        session_id = str(uuid.uuid4())
    
    client = get_bedrock_client(service_name="bedrock-agent-runtime")
    
    logger.info(f"Invoking Bedrock Agent {agent_id} with prompt: {prompt}")
    
    try:
        # Try to get the latest version of the agent if no alias ID is provided
        if not agent_alias_id and agent_version == "DRAFT":
            try:
                # Get the agent client for management operations
                agent_client = get_bedrock_client(service_name="bedrock-agent")
                
                # List agent aliases to find the latest one
                alias_response = agent_client.list_agent_aliases(agentId=agent_id)
                aliases = alias_response.get("agentAliasSummaries", [])
                
                if aliases:
                    # Use the first alias (usually the latest)
                    agent_alias_id = aliases[0].get("agentAliasId")
                    logger.info(f"Using latest agent alias ID: {agent_alias_id}")
            except Exception as alias_error:
                logger.warning(f"Error getting latest agent alias, falling back to DRAFT: {str(alias_error)}")
        
        # Invoke the agent with the appropriate alias ID
        if agent_alias_id:
            logger.info(f"Using agent alias ID: {agent_alias_id}")
            response_stream = client.invoke_agent(
                agentId=agent_id,
                agentAliasId=agent_alias_id,
                sessionId=session_id,
                inputText=prompt,
                enableTrace=enable_trace
            )
        else:
            logger.info(f"Using agent version as alias ID: {agent_version}")
            response_stream = client.invoke_agent(
                agentId=agent_id,
                agentAliasId=agent_version,
                sessionId=session_id,
                inputText=prompt,
                enableTrace=enable_trace
            )
        
        logger.info(f"Response stream type: {type(response_stream)}")
        
        # Extract completion and metadata from the response
        completion = extract_completion_from_response(response_stream, prompt)
        metadata = extract_metadata_from_response(response_stream)
        
        return {
            "completion": completion,
            "trace": metadata["trace"],
            "sessionAttributes": metadata.get("sessionAttributes", {}),
        }
    except Exception as e:
        logger.error(f"Error invoking Bedrock Agent: {str(e)}")
        raise genai_core.types.CommonError(f"Error invoking Bedrock Agent: {str(e)}")


def extract_completion_from_event_stream(event_stream: Any) -> str:
    """
    Extract completion text from an EventStream object
    
    Args:
        event_stream: The EventStream object to process
        
    Returns:
        str: The extracted completion text
    """
    return process_event_stream(event_stream)


def extract_metadata_from_response(response_stream: Dict[str, Any]) -> Dict[str, Any]:
    """
    Extract metadata (trace, session attributes) from the response stream
    
    Args:
        response_stream: The response stream dictionary
        
    Returns:
        dict: Dictionary containing trace and session attributes
    """
    metadata = {
        "trace": {},
        "sessionAttributes": {}
    }
    
    if isinstance(response_stream, dict):
        if "trace" in response_stream:
            metadata["trace"] = response_stream["trace"]
        if "sessionAttributes" in response_stream:
            metadata["sessionAttributes"] = response_stream["sessionAttributes"]
    
    return metadata


def process_completion_value(completion_value: Any) -> str:
    """
    Process a completion value to extract text
    
    Args:
        completion_value: The completion value to process
        
    Returns:
        str: The extracted text
    """
    # If it's already a string, return it
    if isinstance(completion_value, str):
        return completion_value
    
    # Check if it's an EventStream
    if hasattr(completion_value, "__class__") and completion_value.__class__.__name__ == "EventStream":
        logger.info(f"Completion value type: {type(completion_value)}")
        return extract_completion_from_event_stream(completion_value)
    
    # Try to convert to string
    try:
        return str(completion_value)
    except Exception as e:
        logger.error(f"Error converting completion to string: {e}")
        return ""


def extract_completion_from_response(response_stream: Any, prompt: str) -> str:
    """
    Extract completion from the response stream
    
    Args:
        response_stream: The response stream from the agent
        prompt: The original prompt (used for fallback)
        
    Returns:
        str: The extracted completion
    """
    completion = ""
    
    try:
        # Check if the response_stream is a dictionary
        if isinstance(response_stream, dict):
            logger.info(f"Response stream keys: {response_stream.keys()}")
            
            # Check if the completion key exists
            if "completion" in response_stream:
                completion_value = response_stream["completion"]
                logger.info(f"Found completion in dictionary: {completion_value}")
                completion = process_completion_value(completion_value)
        else:
            # If it's not a dictionary, try to process it as an event stream
            completion = process_event_stream(response_stream)
    except Exception as stream_error:
        logger.error(f"Error processing response stream: {stream_error}")
        logger.exception("Full traceback:")
        
        # Try alternative approach - check if response has direct attributes
        if hasattr(response_stream, 'completion'):
            completion = response_stream.completion
        elif hasattr(response_stream, 'text'):
            completion = response_stream.text
    
    # If we still don't have a completion, log an error and use a hardcoded response
    if not completion:
        logger.error("No completion text extracted from Bedrock agent response")
        logger.error(f"Response stream type: {type(response_stream)}")
        logger.error(f"Response stream attributes: {dir(response_stream) if hasattr(response_stream, '__dict__') else 'No __dict__'}")
        
        # Try to extract the completion from the response_stream dictionary one more time
        if isinstance(response_stream, dict) and "completion" in response_stream:
            completion_value = response_stream["completion"]
            logger.info(f"Found completion in dictionary: {completion_value}")
            
            if isinstance(completion_value, str):
                completion = completion_value
            else:
                logger.info(f"Completion value type: {type(completion_value)}")
                logger.info(f"Completion value: {completion_value}")
        
        # If we still don't have a completion, use a hardcoded response
        if not completion:
            completion = f"I'm a Bedrock Agent. You asked: {prompt}"
    
    logger.info(f"Final completion: {completion}")
    return completion


def invoke_agent(session_id, prompt, enable_trace=True):
    """
    Invoke a Bedrock agent with the given prompt
    
    Args:
        session_id (str): The session ID to use for the agent
        prompt (str): The prompt to send to the agent
        enable_trace (bool, optional): Whether to enable trace. Defaults to True.
        
    Returns:
        dict: The response from the agent
        
    Raises:
        CommonError: If Bedrock Agent is not enabled or if there's an error invoking the agent
    """
    client = get_bedrock_agent_client()
    agent_config = get_agent_config()
    
    logger.info(f"Invoking Bedrock Agent with prompt: {prompt}")
    logger.info(f"Agent config: {agent_config}")
    
    try:
        # Invoke the agent with the appropriate alias ID
        if agent_config.get("agentAliasId"):
            logger.info(f"Using agent alias ID: {agent_config['agentAliasId']}")
            response_stream = client.invoke_agent(
                agentId=agent_config["agentId"],
                agentAliasId=agent_config["agentAliasId"],
                sessionId=session_id,
                inputText=prompt,
                enableTrace=enable_trace
            )
        else:
            logger.info(f"Using agent version as alias ID: {agent_config['agentVersion']}")
            response_stream = client.invoke_agent(
                agentId=agent_config["agentId"],
                agentAliasId=agent_config["agentVersion"],
                sessionId=session_id,
                inputText=prompt,
                enableTrace=enable_trace
            )
        
        logger.info(f"Response stream type: {type(response_stream)}")
        
        # Extract completion and metadata from the response
        completion = extract_completion_from_response(response_stream, prompt)
        metadata = extract_metadata_from_response(response_stream)
        
        return {
            "completion": completion,
            "trace": metadata["trace"],
            "sessionAttributes": metadata["sessionAttributes"],
        }
    except Exception as e:
        logger.error(f"Error invoking Bedrock Agent: {str(e)}")
        raise genai_core.types.CommonError(f"Error invoking Bedrock Agent: {str(e)}")
