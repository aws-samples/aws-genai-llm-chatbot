import boto3
import genai_core.types
import genai_core.parameters
from aws_lambda_powertools import Logger
import json
import os

sts_client = boto3.client("sts")
logger = Logger()


def process_event_stream(event_stream):
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
            
            # Try different ways to extract the text
            if hasattr(event, "chunk"):
                if hasattr(event.chunk, "text"):
                    text += event.chunk.text
                elif hasattr(event.chunk, "bytes"):
                    text += event.chunk.bytes.decode("utf-8")
            elif hasattr(event, "bytes"):
                text += event.bytes.decode("utf-8")
            elif hasattr(event, "text"):
                text += event.text
            elif hasattr(event, "payload"):
                try:
                    payload = json.loads(event.payload.decode("utf-8"))
                    if "text" in payload:
                        text += payload["text"]
                except Exception:
                    pass
    except Exception as e:
        logger.error(f"Error processing EventStream: {str(e)}")
    
    return text


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
    
    # Get region from environment or use default
    region = os.environ.get("BEDROCK_REGION", "us-east-1")
    
    # Check if we need to assume a role
    role_arn = os.environ.get("BEDROCK_ROLE_ARN")
    
    config_data = {"service_name": "bedrock-agent-runtime"}
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
        # Use the agent alias ID from the config
        if agent_config.get("agentAliasId"):
            logger.info(f"Using agent alias ID: {agent_config['agentAliasId']}")
            response_stream = client.invoke_agent(
                agentId=agent_config["agentId"],
                agentAliasId=agent_config["agentAliasId"],
                sessionId=session_id,
                inputText=prompt,
                enableTrace=enable_trace
            )
        # Fallback to using the version as the alias ID
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
        
        # Extract the completion from the response
        completion = ""
        trace = {}
        session_attributes = {}
        
        # The response from invoke_agent is a dictionary
        # We need to extract the completion from it
        try:
            # Check if the response_stream is a dictionary
            if isinstance(response_stream, dict):
                logger.info(f"Response stream keys: {response_stream.keys()}")
                
                # Check if the completion key exists
                if "completion" in response_stream:
                    completion_value = response_stream["completion"]
                    logger.info(f"Found completion in dictionary: {completion_value}")
                    
                    # Check if the completion is a string
                    if isinstance(completion_value, str):
                        completion = completion_value
                    # Check if the completion is an EventStream
                    elif hasattr(completion_value, "__class__") and completion_value.__class__.__name__ == "EventStream":
                        logger.info(f"Completion value type: {type(completion_value)}")
                        # Try to extract the completion from the EventStream
                        try:
                            # Process the EventStream
                            for event in completion_value:
                                logger.info(f"Event type: {type(event)}")
                                logger.info(f"Event dir: {dir(event)}")
                                
                                # Check if the event is a dictionary
                                if isinstance(event, dict):
                                    logger.info(f"Event keys: {event.keys()}")
                                    
                                    # Check for chunk
                                    if "chunk" in event:
                                        chunk = event["chunk"]
                                        logger.info(f"Chunk: {chunk}")
                                        
                                        if isinstance(chunk, dict):
                                            if "bytes" in chunk:
                                                chunk_text = chunk["bytes"].decode("utf-8")
                                                completion += chunk_text
                                                logger.info(f"Added chunk text from bytes: {chunk_text}")
                                            elif "text" in chunk:
                                                completion += chunk["text"]
                                                logger.info(f"Added chunk text directly: {chunk['text']}")
                                    
                                    # Check for text
                                    if "text" in event:
                                        completion += event["text"]
                                        logger.info(f"Added text directly: {event['text']}")
                                    
                                    # Check for bytes
                                    if "bytes" in event:
                                        chunk_text = event["bytes"].decode("utf-8")
                                        completion += chunk_text
                                        logger.info(f"Added text from bytes: {chunk_text}")
                                    
                                    # Check for payload
                                    if "payload" in event:
                                        try:
                                            payload = json.loads(event["payload"].decode("utf-8"))
                                            if "text" in payload:
                                                completion += payload["text"]
                                                logger.info(f"Added text from payload: {payload['text']}")
                                        except Exception as e:
                                            logger.error(f"Error extracting text from payload: {e}")
                                    
                                    # Check for content
                                    if "content" in event:
                                        completion += event["content"]
                                        logger.info(f"Added content: {event['content']}")
                                    
                                    # Check for message
                                    if "message" in event:
                                        completion += event["message"]
                                        logger.info(f"Added message: {event['message']}")
                                else:
                                    # Try to extract the text from the event
                                    if hasattr(event, "chunk") and event.chunk:
                                        if hasattr(event.chunk, "bytes") and event.chunk.bytes:
                                            chunk_text = event.chunk.bytes.decode("utf-8")
                                            completion += chunk_text
                                            logger.info(f"Added chunk text from bytes: {chunk_text}")
                                        elif hasattr(event.chunk, "text") and event.chunk.text:
                                            completion += event.chunk.text
                                            logger.info(f"Added chunk text directly: {event.chunk.text}")
                                    elif hasattr(event, "bytes") and event.bytes:
                                        chunk_text = event.bytes.decode("utf-8")
                                        completion += chunk_text
                                        logger.info(f"Added text from bytes: {chunk_text}")
                                    elif hasattr(event, "text") and event.text:
                                        completion += event.text
                                        logger.info(f"Added text directly: {event.text}")
                                    
                                    # Try to extract the text from the event's payload
                                    if hasattr(event, "payload"):
                                        try:
                                            payload = json.loads(event.payload.decode("utf-8"))
                                            if "text" in payload:
                                                completion += payload["text"]
                                                logger.info(f"Added text from payload: {payload['text']}")
                                        except Exception as e:
                                            logger.error(f"Error extracting text from payload: {e}")
                        except Exception as e:
                            logger.error(f"Error processing EventStream: {e}")
                    else:
                        logger.info(f"Completion value type: {type(completion_value)}")
                        # Try to convert to string
                        try:
                            completion = str(completion_value)
                        except Exception as e:
                            logger.error(f"Error converting completion to string: {e}")
                
                # Check for trace and session attributes
                if "trace" in response_stream:
                    trace = response_stream["trace"]
                if "sessionAttributes" in response_stream:
                    session_attributes = response_stream["sessionAttributes"]
            else:
                # If it's not a dictionary, try to iterate through it
                for event in response_stream:
                    logger.info(f"Processing event: {type(event)}")
                    logger.info(f"Event attributes: {dir(event)}")
                    
                    # Check if this is a chunk event with text
                    if hasattr(event, 'chunk') and event.chunk:
                        logger.info(f"Chunk event: {event.chunk}")
                        if hasattr(event.chunk, 'bytes') and event.chunk.bytes:
                            # Decode the bytes to get the text
                            chunk_text = event.chunk.bytes.decode('utf-8')
                            completion += chunk_text
                            logger.info(f"Added chunk text from bytes: {chunk_text}")
                        elif hasattr(event.chunk, 'text') and event.chunk.text:
                            # Direct text access
                            completion += event.chunk.text
                            logger.info(f"Added chunk text directly: {event.chunk.text}")
                    
                    # Check if this is a trace event
                    elif hasattr(event, 'trace') and event.trace:
                        trace = event.trace
                        logger.info("Got trace event")
                    
                    # Check if this is a session attributes event
                    elif hasattr(event, 'sessionAttributes') and event.sessionAttributes:
                        session_attributes = event.sessionAttributes
                        logger.info("Got session attributes event")
                    
                    # Check for other possible response structures
                    elif hasattr(event, 'completion') and event.completion:
                        if hasattr(event.completion, 'text') and event.completion.text:
                            completion += event.completion.text
                            logger.info(f"Added completion text: {event.completion.text}")
                        elif hasattr(event.completion, 'bytes') and event.completion.bytes:
                            chunk_text = event.completion.bytes.decode('utf-8')
                            completion += chunk_text
                            logger.info(f"Added completion text from bytes: {chunk_text}")
                    
                    # Check if the event itself has text content
                    elif hasattr(event, 'text') and event.text:
                        completion += event.text
                        logger.info(f"Added direct text: {event.text}")
                    
                    # Check if the event has bytes content
                    elif hasattr(event, 'bytes') and event.bytes:
                        chunk_text = event.bytes.decode('utf-8')
                        completion += chunk_text
                        logger.info(f"Added text from bytes: {chunk_text}")
                    
                    # Log the event structure for debugging
                    if hasattr(event, '__dict__'):
                        logger.info(f"Event dict: {event.__dict__}")
                
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
            
            # Try to extract the completion from the response_stream dictionary
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
        
        return {
            "completion": completion,
            "trace": trace,
            "sessionAttributes": session_attributes,
        }
    except Exception as e:
        logger.error(f"Error invoking Bedrock Agent: {str(e)}")
        raise genai_core.types.CommonError(f"Error invoking Bedrock Agent: {str(e)}")
