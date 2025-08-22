import os
import json
import base64
import re
import boto3
import mimetypes
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

from aws_lambda_powertools import Logger
from genai_core.bedrock_agent import invoke_agent
from genai_core.types import ChatbotMessageType, FileStorageProvider
from adapters.base import ModelAdapter, Mode

logger = Logger()
s3 = boto3.resource("s3")

# Helper function to convert float values to Decimal and handle binary data for DynamoDB
def json_dumps_decimal(obj):
    if isinstance(obj, float):
        return Decimal(str(obj))
    elif isinstance(obj, bytes):
        return base64.b64encode(obj).decode('utf-8')
    elif isinstance(obj, dict):
        return {k: json_dumps_decimal(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [json_dumps_decimal(i) for i in obj]
    else:
        return obj

# Custom JSON encoder to handle bytes and other non-serializable types
class CustomJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, bytes):
            return base64.b64encode(obj).decode('utf-8')
        elif isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)


def extract_agent_info(model_name: str) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Extract agent ID, name, and alias ID from the model name
    
    Args:
        model_name: The model name in the format "Agent_{name}_{id}"
        
    Returns:
        Tuple of (agent_id, agent_name, agent_alias_id)
    """
    # Check if this is a specific agent or the generic "bedrock_agent"
    if model_name == "bedrock_agent":
        return None, None, None
    
    # Extract agent ID from the model name
    match = re.search(r"Agent_(.*)_([A-Z0-9]+)$", model_name)
    if match:
        agent_name = match.group(1).replace('_', ' ')
        agent_id = match.group(2)
        return agent_id, agent_name, None
    
    return None, None, None


class BedrockAgentAdapter(ModelAdapter):
    """Adapter for Amazon Bedrock Agent"""
    
    def __init__(
        self,
        model_id: str,
        mode: Optional[str] = None,
        session_id: Optional[str] = None,
        user_id: Optional[str] = None,
        model_kwargs: Dict[str, Any] = {},
        **kwargs,
    ):
        self.model_id = model_id
        super().__init__(
            session_id=session_id,
            user_id=user_id,
            mode=mode,
            model_kwargs=model_kwargs,
            **kwargs,
        )
        # Agent doesn't support streaming
        self.disable_streaming = True
        
    def get_llm(self, model_kwargs={}, extra={}):
        """
        Not used for Bedrock Agent, but required by the ModelAdapter
        """
        return None
        
    def add_files_to_message_history(self, images=[], documents=[], videos=[]):
        """
        Add files to the message history
        
        Args:
            images: List of image information dictionaries
            documents: List of document information dictionaries
            videos: List of video information dictionaries
        """
        # Bedrock agent supports files, so we don't need to raise an error
        return
    
    def get_file_from_s3(self, file_info: Dict[str, str], use_s3_path: bool = False) -> Dict[str, Any]:
        """
        Get file content from S3
        
        Args:
            file_info: Dictionary containing file information
            use_s3_path: Whether to return the S3 path instead of the file content
            
        Returns:
            Dictionary containing file content and metadata
        """
        if file_info["provider"] != FileStorageProvider.S3.value:
            logger.warning(f"Unsupported file provider: {file_info['provider']}")
            return {"error": "Unsupported file provider"}
        
        file_key = file_info["key"]
        file_type = file_info["type"]
        
        # If the file is in the user's private directory, prepend the user ID
        if not file_key.startswith("private/"):
            s3_path = f"private/{self.user_id}/{file_key}"
        else:
            s3_path = file_key
            
        logger.info(f"Getting file from S3: {s3_path}")
        
        try:
            # Get the file from S3
            s3_object = s3.Object(os.environ["CHATBOT_FILES_BUCKET_NAME"], s3_path)
            file_content = s3_object.get()["Body"].read()
            
            # Determine the file format based on the file extension
            file_extension = os.path.splitext(file_key)[1].lower()
            if not file_extension and file_type:
                # If no extension, try to determine from the file type
                if file_type == "image":
                    file_extension = ".jpg"  # Default to jpg
                elif file_type == "document":
                    file_extension = ".pdf"  # Default to pdf
                elif file_type == "text":
                    file_extension = ".txt"  # Default to txt
            
            # Remove the leading dot from the extension
            if file_extension.startswith("."):
                file_extension = file_extension[1:]
                
            # Return the file content and metadata
            if use_s3_path:
                return {
                    "type": file_type,
                    "format": file_extension,
                    "source": {
                        "s3Path": f"s3://{os.environ['CHATBOT_FILES_BUCKET_NAME']}/{s3_path}"
                    }
                }
            else:
                return {
                    "type": file_type,
                    "format": file_extension,
                    "source": {
                        "bytes": file_content
                    }
                }
        except Exception as e:
            logger.exception(f"Error getting file from S3: {e}")
            return {"error": str(e)}
    
    def _process_files(self, files: Optional[List[Dict[str, str]]]) -> Optional[List[Dict[str, Any]]]:
        """
        Process files to ensure they're in the correct format for the agent
        
        Args:
            files: List of file information dictionaries
            
        Returns:
            List of processed file information dictionaries
        """
        if not files:
            return None
        
        processed_files = []
        for file in files:
            # Preserve the original key in the processed file data
            original_key = file.get('key')
            if not original_key:
                logger.warning(f"No key found in file info: {file}")
                continue
                
            # Get the file content from S3
            file_data = self.get_file_from_s3(file)
            
            if "error" in file_data:
                logger.warning(f"Error processing file: {file_data['error']}")
                continue
            
            # Make sure the original key is preserved
            file_data['key'] = original_key
                
            # Add the processed file to the list
            processed_files.append(file_data)
            
        return processed_files
    
    def _prepare_file_prompt(self, prompt: str, images: Optional[List[Dict[str, Any]]] = None, documents: Optional[List[Dict[str, Any]]] = None) -> str:
        """
        Prepare the prompt with file information for the agent
        
        Args:
            prompt: The original prompt
            images: List of processed image information dictionaries
            documents: List of processed document information dictionaries
            
        Returns:
            The prompt with file information
        """
        # Log the raw file information for debugging
        if images:
            logger.info(f"Raw image information: {json.dumps([{k: v for k, v in img.items() if k != 'source'} for img in images])}")
            # Also log the original keys from the input images
            original_keys = [img.get('key', 'unknown') for img in images]
            logger.info(f"Original image keys: {original_keys}")
        if documents:
            logger.info(f"Raw document information: {json.dumps([{k: v for k, v in doc.items() if k != 'source'} for doc in documents])}")
            # Also log the original keys from the input documents
            original_keys = [doc.get('key', 'unknown') for doc in documents]
            logger.info(f"Original document keys: {original_keys}")
            
        # If there are no files, return the original prompt without any file information
        if not images and not documents:
            logger.info("No files present, returning original prompt without file information")
            return prompt
            
        # Start building the enhanced prompt with S3 file paths at the beginning
        enhanced_prompt = "### UPLOADED FILES INFORMATION ###\n"
        enhanced_prompt += "The following files have been uploaded and are available for processing:\n\n"
        
        # Add S3 URIs for images
        if images:
            enhanced_prompt += "IMAGES:\n"
            for i, image in enumerate(images):
                # Make sure we're using the actual file key from the uploaded file
                file_key = image.get('key')
                if not file_key:
                    logger.warning(f"No file key found for image {i}, skipping")
                    continue
                    
                s3_uri = f"s3://{os.environ['CHATBOT_FILES_BUCKET_NAME']}/private/{self.user_id}/{file_key}"
                enhanced_prompt += f"{i+1}. Filename: {file_key}\n   S3 URI: {s3_uri}\n   Format: {image.get('format', 'jpg')}\n\n"
        
        # Add S3 URIs for documents
        if documents:
            enhanced_prompt += "DOCUMENTS:\n"
            for i, doc in enumerate(documents):
                # Make sure we're using the actual file key from the uploaded file
                file_key = doc.get('key')
                if not file_key:
                    logger.warning(f"No file key found for document {i}, skipping")
                    continue
                    
                s3_uri = f"s3://{os.environ['CHATBOT_FILES_BUCKET_NAME']}/private/{self.user_id}/{file_key}"
                enhanced_prompt += f"{i+1}. Filename: {file_key}\n   S3 URI: {s3_uri}\n   Format: {doc.get('format', 'pdf')}\n\n"
        
        enhanced_prompt += "### USER QUERY ###\n" + prompt
        
        # Add information about the files
        file_descriptions = []
        
        # Log file information for debugging
        if images:
            logger.info(f"Processing {len(images)} images")
            for i, image in enumerate(images):
                if "source" in image and "bytes" in image["source"]:
                    logger.info(f"Image {i} format: {image.get('format', 'unknown')}, size: {len(image['source']['bytes'])} bytes")
                else:
                    logger.info(f"Image {i} has no bytes data")
        
        if documents:
            logger.info(f"Processing {len(documents)} documents")
            for i, doc in enumerate(documents):
                if "source" in doc and "bytes" in doc["source"]:
                    logger.info(f"Document {i} format: {doc.get('format', 'unknown')}, size: {len(doc['source']['bytes'])} bytes")
                else:
                    logger.info(f"Document {i} has no bytes data")
        
        # Only providing S3 URIs for the agent to use with the /get-file endpoint
                    
        # Reminder about the S3 URIs
        enhanced_prompt += "\n\n### REMINDER ###"
        enhanced_prompt += "\nYou can use the S3 URIs provided at the beginning of this message with your /get-file endpoint to retrieve and process the files."
        
        # The agent will use the /get-file endpoint to retrieve files, so we don't need to provide API schema information here.
        # The agent will need to know the S3 bucket name and the user's private directory.
        enhanced_prompt += "\n\n### S3 ACCESS INFORMATION ###"
        enhanced_prompt += "\nWhen using the /get-file endpoint to retrieve files from S3:"
        enhanced_prompt += f"\n- S3 bucket name: '{os.environ['CHATBOT_FILES_BUCKET_NAME']}'"
        enhanced_prompt += f"\n- User's private directory: 'private/{self.user_id}'"
        enhanced_prompt += "\n- Full S3 path format: s3://<bucket_name>/private/<user_id>/<filename>"
        
        return enhanced_prompt
        
    def _create_system_prompt(self, has_files=False) -> str:
        """
        Create a system prompt that includes basic information for the agent
        
        Args:
            has_files: Whether files are present in the current request
            
        Returns:
            System prompt string
        """
        system_prompt = "You are a helpful AI assistant with access to various APIs to help users with their requests."
        
        # Only include file handling instructions if files are present
        if has_files:
            # The agent will use the /get-file endpoint to retrieve files
            system_prompt += "\n\nWhen files are uploaded, you will receive their S3 URIs in the format:"
            system_prompt += f"\ns3://{os.environ['CHATBOT_FILES_BUCKET_NAME']}/private/{self.user_id}/<filename>"
            system_prompt += "\n\nYou can use these URIs with your /get-file endpoint to retrieve and process the files."
        
        return system_prompt
        
    def run(
        self,
        prompt: str,
        workspace_id: Optional[str] = None,
        user_groups: Optional[List[str]] = None,
        images: Optional[List[Dict[str, str]]] = None,
        documents: Optional[List[Dict[str, str]]] = None,
        videos: Optional[List[Dict[str, str]]] = None,
        system_prompts: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """Run the agent with the given prompt"""
        try:
            # Log the raw input file information for debugging
            if images:
                logger.info(f"Input images: {str(images)}")
            if documents:
                logger.info(f"Input documents: {str(documents)}")
                
            # Add the prompt to the chat history
            self.chat_history.add_user_message(prompt)
            
            # Process files to ensure they're in the correct format
            processed_images = self._process_files(images) if images else None
            processed_documents = self._process_files(documents) if documents else None
            
            # Prepare the prompt with file information
            enhanced_prompt = self._prepare_file_prompt(prompt, processed_images, processed_documents)
            
            # Check if there are any files
            has_files = bool(processed_images or processed_documents)
            
            # Add system prompt with API schema information
            system_prompt = self._create_system_prompt(has_files=has_files)
            if system_prompt:
                enhanced_prompt = f"{system_prompt}\n\nUser request: {enhanced_prompt}"
            
            # Extract agent ID from model name if it's in the format "Agent_{name}_{id}"
            agent_id, agent_name, _ = extract_agent_info(self.model_id)
            
            # If a specific agent ID was extracted, use invoke_agent_by_id
            if agent_id:
                logger.info(f"Using specific agent: {agent_name} ({agent_id})")
                from genai_core.bedrock_agent import invoke_agent_by_id
                response = invoke_agent_by_id(
                    agent_id=agent_id,
                    session_id=self.session_id,
                    prompt=enhanced_prompt,
                    enable_trace=True,
                    timeout=30  # Use a shorter timeout to avoid Lambda timeouts
                )
            else:
                # Otherwise use the default agent from environment variables
                logger.info("Using default agent from environment variables")
                response = invoke_agent(
                    session_id=self.session_id,
                    prompt=enhanced_prompt,
                    enable_trace=True,
                    timeout=30  # Use a shorter timeout to avoid Lambda timeouts
                )
            
            # Extract the completion text
            completion = response.get("completion", "")
            
            # Convert any float values in the trace to Decimal for DynamoDB compatibility
            trace = json_dumps_decimal(response.get("trace", {}))
            
            # Add the agent's response to the chat history
            # We need to manually add the message to DynamoDB to handle float values
            from langchain_core.messages import AIMessage
            from langchain.schema import messages_to_dict, _message_to_dict
            from datetime import datetime
            
            # Get existing messages
            messages = messages_to_dict(self.chat_history.get_messages_from_storage())
            
            # Create and add the AI message
            ai_message = AIMessage(content=completion)
            _message = _message_to_dict(ai_message)
            messages.append(_message)
            
            # Save to DynamoDB with proper float handling
            try:
                # Convert all floats to Decimal and handle binary data for DynamoDB compatibility
                messages_json = json.dumps(messages, cls=CustomJSONEncoder)
                messages_with_decimal = json.loads(messages_json, parse_float=Decimal)
                
                self.chat_history.table.put_item(
                    Item={
                        "SessionId": self.session_id,
                        "UserId": self.user_id,
                        "StartTime": datetime.now().isoformat(),
                        "History": messages_with_decimal,
                    }
                )
            except Exception as err:
                logger.exception(f"Error saving message to DynamoDB: {err}")
            
            # Create metadata for the response
            metadata = json_dumps_decimal({
                "modelId": self.model_id,
                "modelKwargs": self.model_kwargs,
                "mode": self._mode,
                "sessionId": self.session_id,
                "userId": self.user_id,
                "documents": [],
                "trace": trace,
            })
            
            # Add metadata to the chat history if the user is an admin
            if user_groups and ("admin" in user_groups or "workspace_manager" in user_groups):
                # We need to manually add the metadata to avoid float issues
                try:
                    # Get the latest messages again (including our newly added AI message)
                    messages = messages_to_dict(self.chat_history.get_messages_from_storage())
                    if messages:
                        # Add metadata to the last message
                        messages[-1]["data"]["additional_kwargs"] = metadata
                        
                        # Save to DynamoDB with proper float handling
                        messages_json = json.dumps(messages, cls=CustomJSONEncoder)
                        messages_with_decimal = json.loads(messages_json, parse_float=Decimal)
                        
                        self.chat_history.table.put_item(
                            Item={
                                "SessionId": self.session_id,
                                "UserId": self.user_id,
                                "StartTime": datetime.now().isoformat(),
                                "History": messages_with_decimal,
                            }
                        )
                except Exception as err:
                    logger.exception(f"Error adding metadata to DynamoDB: {err}")
            
            # Return the response in the expected format
            # Convert to a regular dictionary instead of using json_dumps_decimal
            response = {
                "sessionId": self.session_id,
                "type": ChatbotMessageType.AI.value,
                "content": completion,
                "metadata": metadata if user_groups and ("admin" in user_groups or "workspace_manager" in user_groups) else {
                    "sessionId": self.session_id,
                },
            }
            
            return response
            
        except Exception as e:
            logger.exception("Error invoking Bedrock Agent")
            raise e
