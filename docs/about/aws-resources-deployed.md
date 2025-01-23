# AWS Resources Deployed

## Overview
This page aims to document the AWS Resources that will be deployed to help understand what permissions will be required to successfully deploy the solution.

Because the solution is configurable to deploy an array of resources, not all resources described in the list may be applicable to your deployment. 

It is recommended to review the full documentation to understand deployment configurations, security & cost implications, and overall best practices. 

Please note: This is list is considered a best effort approach to helping you understand resources within your environment and may not be not be all encompassing. Please make sure you review the solution and validate requirements before deploying. 


## Authentication 

### Amazon Cognito
* **User Pool** [**Required**]
* **User Pool Client** [**Required**]
    * Attach an existing Cognito Domain for Federation, adds Permission for User Pool to leverage existing Cognito Domain / Creates OIDC or SAML Identity Provider in Cognito [*Optional*]
* **User Groups** [**Required**]
    * Admin and workspace_manager roles allow applications (configurable chatbots) and workspace management retrospectively.

## Retrieval Augmented Generation (RAG) Engines
This section describes the RAG engines that house and return stored data for use with Generative AI. Additionally this section includes resources deployed to support data ingestion and processing for RAG.

### Amazon Aurora PostgreSQL
* **RAG Workspaces**: If option is enabled, users can create PostgreSQL w/ pgvector data stores for Retrieval Augmented Generation (RAG) workspaces. [*Optional*]
    * *Note:* This is not enabled by default, user must choose to enable this during pre-deployment configuration.

### Amazon OpenSearch Serverless Service
* **RAG Workspaces**: If option is enabled, users can create OpenSearch Serverless Collections for Retrieval Augmented Generation (RAG) workspaces. [*Optional*]
    * *Note:* This is not enabled by default, user must choose to enable this during pre-deployment configuration.

### Amazon Kendra
* **RAG Workspaces**: If option is enabled, users can create Kendra data stores for Retrieval Augmented Generation (RAG) workspaces. [*Optional*]
    * *Note:* This is not enabled by default, user must choose to enable this during pre-deployment configuration.

### Amazon Simple Storage Service (S3)
* **File Uploads Bucket**: Files uploaded into a RAG workspaces [**Required**]
* **Processing Bucket**: Bucket to house files being processed for a RAG workspace [**Required**]

### DynamoDB
* **WorkSpaces Table**: Table that houses data about the RAG Workspaces. Does not house the actual RAG data, but rather the metadata/configuration data for the Workspace. [**Required**]
* **Documents Table**: Table that houses the data about documents that have been or need to be ingested into RAG workspaces (websites, PDFs, text files, RSS feeds, etc.) [**Required**]

### Step Functions
* **File Import Workflow**: State Machine responsible for processing the workflow for ingesting files [**Required**]
* **Website Crawling Workflow**: State Machine responsible for processing the workflow for Website Crawling [**Required**]
* **Delete Workspace Workflow**: State Machine responsible for processing RAG Workspace deletions (removing resource associated with the RAG Workspace) [**Required**]
* **Delete Document Workflow**: State Machine responsible for processing the deletion of a document from within a RAG Workspace [**Required**]

### Amazon Batch
* **Website Crawler Batch Job**: Executes a batch job which runs in an **EC2 Instance** in an ECS Container to handle website crawling processes. The instance is terminated when processing is not active.
* **File Import Batch Job**: Executes a batch job  which runs in an **EC2 Instance** in an ECS Container to handle file import processes. The instance is terminated when processing isn't active.

### Amazon Simple Queue Service (SQS)
* **Ingestion Queue**: Queue that receives what needs to be ingested and is down stream processed. [**Required**]

### Lambda Functions
* **RSS Ingestor**: Lambda Function responsible for retrieving the latest data from RSS Feed, queueing new posts [**Required**]
* **Trigger RSS Ingestors Function**: Triggers the RSS Ingestor function for each RSS Feed with an enabled subscription in the Workspace. [**Required**]
    * *Note:* This is triggered by an EventBridge Rule to execute on a fixed Rate
* **Crawl Queued RSS Posts Function**: Lambda Function responsible for triggering the Website Crawling Workflow for each RSS Post that requires ingestion [**Required**]
    * *Note:* This is triggered by an EventBridge Rule to execute on a fixed Rate
* **Upload Handler Function**: Function responsible for handling file uploads [**Required**]

## Chatbot API

### DynamoDB
* **Session Table**: Houses user chat sessions with chatbot [**Required**]

### Amazon Simple Storage Service (S3)
* **Logs Bucket**: Houses logs for Chatbot API [**Required**]
* **Files Bucket**: Houses files uploaded during chat with chatbot [**Required**]
* **User Feedback Bucket**: Houses data from feedback provided by users chatting with the chatbot and selecting to provide feedback. [**Required**]


### Amazon Simple Notification Service (SNS)
* **Messages Topic**: Topic for managing message bus [**Required**]

### Amazon Simple Queue Service (SQS)
* **Outgoing Messages Queue**: Queue for managing outgoing messages [**Required**]
* **Outgoing Messages Dead-Letter Queue (DLQ)**: Queue for handling Dead-Letter messages from the Outgoing Messages Queue [**Required**]

### AWS Lambda Functions
* **AppSync GraphQL API Handler**: Function responsible for handling all inbound GraphQL API requests and processing them. [**Required**]
    * *Note*: The AppSync API handler acts as a single lambda for all API requests. This means that this function has a fairly **broad** permission set attached to interact with database, data stores, AWS Services, etc. 

### AppSync
* **GraphQL API**: Primary API for App, containing both Realtime Streaming for Chatbot and Rest API for data. [**Required**]
    * *Note:* Optionally set GraphQL to be private, within a VPC and not exposed to public internet. 
    * GraphQL API Resolvers have permissions to call their defined functions/endpoints

## User Interface

### Amazon Simple Storage Service (S3)
* **Upload Logs Bucket**: Bucket that logs from user uploads is stored [**Required**]
* **Website Bucket**: Bucket that contains the front-end React-based UI [**Required**]

### Amazon CloudFront
* **Front-End Distribution**: Public facing CDN serving the website content from the Website Bucket. [*Optional*, default included]
    * *Note*:By default, the solution is configured as public facing with a CloudFront Distribution. During pre-deployment configuration, the solution can be deployed inside a VPC as a private site.
    * "Public" refers to accessibility of the website, not ability to login. A Public site leverages Amazon Cognito as described in the Authentication section.

### VPC, Load Balancing, & Networking
* **Private Website Configuration**: The solution can be deployed as a private site, with restricted external access. During pre-deployment configuration, the solution can be deployed within a VPC by deploying an **Application Load Balancer** inside the **VPC**. This additionally routes traffic between services via VPC Endpoints (e.g. S3 access) [*Optional*, alternative to CloudFront deployment]


## ML Models & Endpoints
*Note:* During the pre-deployment configuration, there is a range of configurations that can be applied to customize model usage to meet specific needs. There is model usage associated with inference and text embedding. 

### Bedrock
* **General Model Access**: General access to all bedrock models enabled in the account/region. [*Optional*]
    * Bedrock access be disabled (not enabled) via the configuration process before deployment. 
* **Restricted Model Access**: If Bedrock is enabled, an IAM Role ARN can be provided to set custom permissions. This is the alternative to the General Model Access. [*Optional*]

### SageMaker
* **Deployed Models**: Access to the deployment models. This is customizable during the pre-deployment configuration and can vary depending on settings applied. [*Optional*]



---

*This list  does **not** include details around the IAM permissions required for operation of the solution as much of the permissions dynamic based on the pre-deployment configurations.*