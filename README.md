# AWS GenAI LLM Chatbot

Enterprise-ready generative AI chatbot with RAG capabilities.

## Overview

The AWS GenAI LLM Chatbot is a production-ready solution that enables organizations to deploy a secure, feature-rich chatbot powered by large language models (LLMs) with Retrieval Augmented Generation (RAG) capabilities.

## Key Features

- **Multiple LLM Support**: Amazon Bedrock (Claude, Llama 2), SageMaker, and custom model endpoints
- **Nexus Gateway Integration**: Connect to Nexus Gateway for additional model access
- **Comprehensive RAG Implementation**: Connect to various data sources for context-aware responses
- **Enterprise Security**: Fine-grained access controls, audit logging, and data encryption
- **Conversation Memory**: Full conversation history with persistent storage
- **Web UI and API Access**: Modern React interface and API endpoints for integration
- **Cost Optimization**: Token usage tracking and cost management features
- **Deployment Flexibility**: Multiple deployment options to fit your needs

## Getting Started

This blueprint deploys the complete AWS GenAI LLM Chatbot solution in your AWS account.

### Prerequisites

- AWS Account with appropriate permissions
- AWS CLI configured with credentials
- Node.js 18+ and npm
- Python 3.8+
- AWS CDK CLI version compatible with aws-cdk-lib 2.206.0 or later
  ```bash
  # Install or update the CDK CLI globally
  npm install -g aws-cdk@latest
  
  # Verify the installed version
  cdk --version
  ```

> **Important**: The CDK CLI version must be compatible with the aws-cdk-lib version used in this project (currently 2.206.0). If you encounter a "Cloud assembly schema version mismatch" error during deployment, update your CDK CLI to the latest version using the command above.

### Deployment

The deployment process is fully automated using AWS CDK and SeedFarmer.

## Architecture

The solution architecture includes:

- Amazon Bedrock for LLM access
- Amazon OpenSearch for vector storage
- Amazon S3 for document storage
- Amazon Cognito for authentication
- AWS Lambda for serverless processing
- Amazon API Gateway for API access
- React-based web interface

## Documentation

For complete documentation, visit the [GitHub repository](https://github.com/aws-samples/aws-genai-llm-chatbot).

## License

This project is licensed under the MIT-0 License.
