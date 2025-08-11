# Bedrock Agent Implementation Plan for AWS GenAI LLM Chatbot

## Overview

This document outlines the implementation of Amazon Bedrock agent support in the AWS GenAI LLM Chatbot. The implementation allows users to configure and use Bedrock agents through the chatbot interface, providing an additional AI capability alongside existing LLM providers.

## Current Architecture

The AWS GenAI LLM Chatbot currently supports:
- Multiple LLM providers (Bedrock, SageMaker, OpenAI, etc.)
- RAG capabilities with various data stores (OpenSearch, Aurora, Kendra)
- Bedrock Knowledge Bases
- Guardrails for responsible AI

## Implementation Details

### 1. Configuration Updates

**System Configuration**
- Extended the `bedrock` section in the config.json file to include agent configuration
- Added fields for:
  - `enabled`: Boolean to toggle agent functionality
  - `agentId`: The ID of the Bedrock agent to use
  - `agentVersion`: The version of the agent (e.g., "DRAFT" or specific version)
  - `agentAliasId`: Optional alias ID for the agent

**Configuration CLI**
- Added prompts in the CLI setup process to configure Bedrock agent
- Added questions to ask if the user wants to enable Bedrock agent (only if Bedrock is enabled)
- If enabled, prompts for agent ID, version, and alias ID
- Updated the configuration object creation to include agent settings
- Added support for non-interactive mode using environment variables

### 2. Backend Implementation

**Bedrock Agent Client Module**
- Created a new module for Bedrock agent integration in the Python SDK layer
- Implemented functions to:
  - Get a Bedrock agent client with proper region configuration
  - Handle cross-account access if needed
  - Invoke the agent with proper parameters
  - Process the response from the agent

**Bedrock Agent Adapter**
- Created an adapter class that extends the BaseAdapter
- Implemented methods to interact with Bedrock agents
- Added support for handling agent responses and formatting them for the chatbot interface
- Registered the adapter in the registry to make it available for use

**Response Processing**
- Added support for processing the EventStream response from Bedrock agents
- Implemented handling for dictionary events in the EventStream
- Added extraction of text from various response formats
- Added fallback mechanisms for when text extraction fails

### 3. Environment and Permissions

**Environment Variables**
- Added environment variables for Bedrock agent configuration:
  - `BEDROCK_AGENT_ID`: The ID of the agent
  - `BEDROCK_AGENT_VERSION`: The version of the agent
  - `BEDROCK_AGENT_ALIAS_ID`: The alias ID for the agent
  - `BEDROCK_REGION`: The AWS region where the agent is deployed

**IAM Permissions**
- Updated IAM permissions to allow the Lambda function to invoke Bedrock agents
- Added necessary permissions for cross-account access if needed

### 4. Model Registration

**Model Provider**
- Updated the direct model provider to include Bedrock agent models
- Added a function to list available Bedrock agent models
- Added configuration to enable/disable Bedrock agent models based on the config

**Model Interface**
- Registered the Bedrock agent adapter with the pattern "bedrock.bedrock_agent"
- Ensured the adapter is properly loaded and available for use

### 5. Error Handling and Logging

**Error Handling**
- Added specific error handling for Bedrock agent-related errors
- Implemented fallback mechanisms for when agent invocation fails
- Added user-friendly error messages for common issues

**Logging**
- Added detailed logging for Bedrock agent interactions
- Logged the response format and structure for debugging
- Added logging for successful and failed agent invocations

## Testing and Validation

- Tested the configuration flow to ensure agent settings are properly saved
- Tested the integration with Bedrock agent using sample queries
- Validated the responses from Bedrock agent are properly formatted and displayed
- Tested error handling for various failure scenarios
- Verified cross-region functionality works correctly

## Challenges and Solutions

**Challenge 1: Response Format**
- The response from Bedrock agent is a nested structure with an EventStream
- Solution: Implemented a recursive approach to extract text from various levels of the response

**Challenge 2: Region Configuration**
- Bedrock agents may be deployed in a different region than the default
- Solution: Added explicit region configuration and passing it to the Bedrock client

**Challenge 3: Event Processing**
- Events in the EventStream are dictionaries, not objects with attributes
- Solution: Added specific handling for dictionary events with various key patterns

## Future Enhancements

- Support for streaming responses from Bedrock agents
- Enhanced error handling and recovery mechanisms
- UI improvements for agent-specific features
- Integration with agent action groups
- Support for agent knowledge bases
- Performance optimizations for agent invocations
