# AWS GenAI LLM Chatbot - SeedFarmer Blueprint

This directory contains the SeedFarmer blueprint (also known as a "capability" in Nexus terminology) for deploying the AWS GenAI LLM Chatbot solution.

## What is SeedFarmer?

[SeedFarmer](https://seed-farmer.readthedocs.io/) is a deployment framework designed to simplify the process of deploying complex AWS solutions across multiple accounts and regions. It provides a consistent way to define, deploy, and manage infrastructure using a hierarchical structure of deployments, groups, and modules.

> **Note:** In the Nexus ecosystem, the terms "blueprint" and "capability" are used interchangeably to refer to a SeedFarmer deployment configuration.

## Directory Structure

```
aws-genai-llm-chatbot/
├── assets/                      # Visual assets and example configurations
│   ├── chatbot-icon.svg         # Icon for the catalog listing
│   ├── chatbot-thumbnail.svg    # Thumbnail for the catalog detail page
│   └── example-input.yaml       # Example input parameters
├── modules/                     # SeedFarmer modules
│   └── chatbot/                 # Main chatbot module
│       ├── deployspec.yaml      # Deployment instructions
│       └── module.yaml          # Module definition
├── package/                     # Package for Nexus integration
│   └── package/                 # Nested directory required by Nexus
│       └── capability.yaml      # Copy of capability.yaml for Lambda processing
├── capability.yaml              # Blueprint definition for Nexus catalog
├── deployment.yaml              # SeedFarmer deployment manifest
├── README.md                    # This file
└── seedfarmer.yaml              # Project metadata
```

## File Descriptions

### capability.yaml

This file defines the blueprint for the Nexus catalog, including:
- Metadata: name, description, version
- Input parameters and their validation rules
- Deployment environments
- Labels for categorization

This is the primary file that determines how the solution appears in the Nexus catalog and what configuration options are available to users.

### deployment.yaml

The main SeedFarmer deployment manifest that defines:
- Deployment structure
- Target accounts and regions
- Module groups and their relationships
- Environment variable mapping

This file serves as the entry point for SeedFarmer when deploying the solution.

### seedfarmer.yaml

Contains project metadata:
- Project name and description
- Reference to README.md for documentation

This file provides additional context for the SeedFarmer deployment.

### modules/chatbot/module.yaml

Defines the chatbot module:
- Parameters passed from environment variables
- Output definitions for deployed resources
- Stack naming convention

This file specifies how the CDK stack should be deployed and what outputs should be collected.

### modules/chatbot/deployspec.yaml

Contains deployment instructions:
- Commands to execute during deployment
- Environment variable handling
- CDK deployment configuration
- Cleanup commands for destruction

This file is executed by SeedFarmer during the deployment process.

### assets/example-input.yaml

Provides an example configuration with:
- Sample values for all parameters
- Comments explaining each parameter
- Default values and recommendations

This file helps users understand how to configure the solution.

### assets/chatbot-icon.svg and assets/chatbot-thumbnail.svg

Visual assets for the Nexus catalog:
- Icon: Small image for the catalog listing
- Thumbnail: Larger image for the catalog detail page

These files enhance the visual presentation of the solution in the Nexus catalog.

## Deployment Process

When deployed through SeedFarmer or the Nexus catalog, the process follows these steps:

1. User selects the blueprint from the Nexus catalog
2. User configures parameters through the Nexus UI
3. SeedFarmer creates a deployment manifest based on these parameters
4. SeedFarmer deploys the modules in the specified order
5. Outputs are collected and made available to the user

## Key Parameters

The blueprint supports several configuration parameters:

- **Core Parameters**: PREFIX, BEDROCK_REGION, TARGET_ACCOUNT
- **Feature Flags**: BEDROCK_ENABLE, RAG_ENABLE, NEXUS_ENABLE
- **Security Options**: CREATE_CMKS, RETAIN_ON_DELETE
- **RAG Options**: RAG_OPENSEARCH_ENABLE
- **Nexus Integration**: NEXUS_GATEWAY_URL, NEXUS_AUTH_CLIENT_ID, etc.

## Additional Resources

- [SeedFarmer Documentation](https://seed-farmer.readthedocs.io/)
- [Nexus Blueprint Guide](https://nexus-3p-vending-d523f3.pages.aws.dev/)
- [AWS GenAI LLM Chatbot Documentation](https://github.com/aws-samples/aws-genai-llm-chatbot)
