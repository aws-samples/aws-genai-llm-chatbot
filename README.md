# Deploy a multi LLM powered chatbot using AWS CDK on AWS

![sample](assets/sample.gif "AWS LLM CHATBOT SAMPLE")

## Table of content
- [Features](#features)
- [Architecture](#architecture)
- [Security](#security)
- [Precautions](#precautions)
- [Service Quotas and Preview Access](#service-quotas-and-preview-access)
- [Deploy](#deploy)
- [Clean up](#clean-up)
- [Credits](#credits)
- [License](#license)

# Features

## Ready to use
This sample provides code ready to use so you can start **experimenting right away without service quota increase or preview access requests.**

However, for enchanced performances and additional features provided in this sample such as **Amazon SageMaker Foundation models** support you are required to request such increases and preview access. More details here.

## Multimodel 
You have the flexibility to test multiple LLM models concurrently. This unique feature is enabled by a user-friendly web UI, allowing for a smoother comparison and assessment of different models within your own VPC.

<img src="assets/multimodel.gif" width="50%">

## AWS Lambda Response Streaming
The sample takes advantage of the newly released **Lambda Response Streaming** feature, showcasing LLM streaming capabilities even with synchronous requests to **SageMaker endpoints**.


| <img src="assets/modes/streaming.gif" width="100%"> | <img src="assets/modes/standard.gif" width="97%"> |
|:--:|:--:|
| Streaming by querying for small batches of token predictions  | Single syncrounous request |

## Full-fledged UI
The repository also includes a **full-fledged UI** built with React to interact with the deployed LLMs as chatbots. It supports both synchronous requests and streaming modes for hitting LLM endpoint, allows managing conversation history, switching between deployed models, and even features a dark mode for user preference.

## LLM providers 

#### SageMaker Foundation Models
The project allows you to deploy models from **SageMaker Foundation models** by specifying the model ARN. This simplifies the deployment process of these powerful AI models on AWS.

#### Deploy publicly Accessible LLM on Hugging Face
The solution provides support for all publicly accessible LLMs on **Hugging Face**, thereby expanding your model options and letting you leverage a wide variety of pre-trained models available on this platform.

####  Models with custom inference
To ensure broader compatibility, the solution also allows deployment of all other models from Hugging Face not supported by HuggingFace TGI container using custom inference code. This process is powered by **AWS CodeBuild**.

## Semantic search
The sample provides an optional stack to implement a **vector database** on **Amazon RDS** with **pgvector** and embeddings. 

Showcasing **Hybrid Search** (Similiary Search + Full Text Seach) and emerging patterns in LLM applications such as "In-Context Learning" (RAG) with automatic document indexing on **Amazon S3** upload.

# Architecture
Here's an overview of the sample's structure:

![sample](assets/architecture.png "Architecture Diagram")

### VPC Stack
This stack deploys public, private, and isolated subnets. The public subnet is used for the chatbot backend supporting the user interface, the private subnet is used for SageMaker models, and the isolated subnet is used for the RDS database. Additionally, this stack deploys VPC endpoints for SageMaker endpoints, AWS Secrets Manager, S3, and Amazon DynamoDB, ensuring that traffic stays within the VPC when appropriate.

### ChatBot Stack
This stack contains the necessary resources to set up a chatbot system, including:
- The ability to deploy one or more large language models through a custom construct, supporting three different techniques: 
  - Deploying models from SageMaker Foundation models by specifying the specific model ARN.
  - Deploying models supported by the HuggingFace TGI container.
  - Deploying all other models from Hugging Face with custom inference code.
- Backend resources for the user interface, including chat backend actions and a Cognito user pool for authentication.
- A DynamoDB-backed system for managing conversation history.

This stack also incorporates "model adapters", enabling the setup of different parameters and functions for specific models without changing the core logic to perform requests and consume responses from SageMaker endpoints for different LLMs.

### [Optional] Semantic Search Stack 
An optional semantic search stack that deploys:
- A vector database via a custom construct built on top of PostgreSQL on RDS with pgvector.
- An embeddings model on SageMaker to generate embeddings.
- Encoders model on SageMaker used to rank sentences by similarity.
- An S3 bucket to store documents that, once uploaded, are automatically split up, converted into embeddings, and stored in the vector database.
- A Lambda function showcasing how to run hybrid search with pgvector. This function also serves as the entry point for this stack.

## [Optional] User Interface
A comprehensive UI built with React that interacts with the deployed LLMs as chatbots, supporting sync requests and streaming modes to hit LLM endpoints, managing conversation history, stopping model generation in streaming mode, and switching between all deployed models for experimentation.

This sample thus provides a robust platform for experimenting with the deployment of LLMs in the AWS ecosystem.

# Security

This sample underscores the importance of security in building LLM applications. Here are the key security measures showcased in this sample:

## Deployment in Private and Isolated Subnets
The LLM models and vector databases are deployed in private and isolated subnets, providing an additional layer of protection.

## Use of VPC Endpoints
**VPC endpoints** are used for in-VPC traffic, ensuring that traffic that doesn't need to leave the VPC stays within the VPC.

## Cognito Authentication for User Interface
The user interface employs **Cognito** for authentication, ensuring secure access to the chatbot.

# Precautions

Before you begin using the sample, there are certain precautions you must take into account:

- **Cost Management**: Be mindful of the costs associated with AWS resources. While the sample is designed to be cost-effective, leaving resources running for extended periods or deploying numerous LLMs can quickly lead to increased costs.

- **Licensing obligations**: If you choose to use any datasets or models alongside the provided samples, ensure you check LLM code and comply with all licensing obligations attached to them.


# Service Quotas and Preview Access
No service quota or preview access is needed to start experimenting with the provided sample. However to leverage specific features and for enchanced speed you are currently required to request quota increase and preview access. Specifically:

## Instance type quota increase
You might consider requesting an increase in service quota for specific SageMaker instance types such as the `ml.g5` instance type. This will give access to latest generation of GPU/Multi-GPU instances types. You can do this from the AWS console.

## Foundation Models Preview Access
If you are looking to deploy models from SageMaker foundation models, you need to request preview access from the AWS console.
Futhermore, make sure which regions are currently supported for SageMaker foundation models here.

# Deploy

###  Prerequisites

Verify that your environment satisfies the following prerequisites:

You have:

1. An [AWS account](https://aws.amazon.com/premiumsupport/knowledge-center/create-and-activate-aws-account/)
2. `AdministratorAccess` policy granted to your AWS account (for production, we recommend restricting access as needed)
3. Both console and programmatic access
4. [AWS CLI](https://aws.amazon.com/cli/) installed and configured to use with your AWS account
5. [NodeJS 12+](https://nodejs.org/en/download/) installed
6. [Typescript 3.8+](https://www.typescriptlang.org/download) installed
7. [AWS CDK CLI](https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html) installed
8. [Docker](https://docs.docker.com/get-docker/) installed
9. [Python 3+](https://www.python.org/downloads/) installed


### Prepare CDK

The solution will be deployed into your AWS account using infrastructure-as-code wih the [AWS Cloud Development Kit](https://aws.amazon.com/cdk/) (CDK).

1. Clone the repository:

```bash
git clone https://github.com/aws-samples/aws-genai-llm-chatbot
```

2. Navigate to this project on your computer using your terminal:

```bash
cd aws-genai-llm-chatbot
```

3. Install the project dependencies by running this command:

```bash
npm install
```

4. (Optional) Bootstrap AWS CDK on the target account and regioon

> **Note**: This is required if you have never used AWS CDK before on this account and region combination. ([More information on CDK bootstrapping](https://docs.aws.amazon.com/cdk/latest/guide/cli.html#cli-bootstrap)).

```bash
npx cdk bootstrap aws://{targetAccountId}/{targetRegion}
```

### Deploy the solution to your AWS Account

1. Verify that Docker is running with the following command:

```bash
docker version
```

> **Note**: If you get an error like the one below, then Docker is not running and need to be restarted:

```bash
Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?
```

2. Deploy the sample using the following CDK command:

```bash
npx cdk deploy --all
```

> **Note**: This step duration can vary a lot, depending on the model(s) you want to deploy, for example the very first deployment with Falcon-40B can take about 30 minutes.


3. You can view the progress of your CDK deployment in the [CloudFormation console](https://console.aws.amazon.com/cloudformation/home) in the selected region.

4. Once deployed, take note of the UI URL `GenAI-ChatBotUIStack.DomainName` value

```bash
...
Outputs:
GenAI-ChatBotUIStack.DomainName = dxxxxxxxxxxxxx.cloudfront.net
...
```

5. Make sure to add a user to the generated Cognito User Pool in order to be able to access the webapp.


# Clean up
You can remove the stacks and all the associated resources created in your AWS account by running the following command:

```bash
npx cdk destroy --all
```

# Credits

This sample was made possible thanks to the following libraries:
- [langchain](https://python.langchain.com/docs/get_started/introduction.html) from [Harrison Chase](https://github.com/hwchase17)
- [pgvector](https://github.com/sbtinstruments/asyncio-mqtt) from [Andrew Kane](https://github.com/ankane)

# License

This library is licensed under the MIT-0 License. See the LICENSE file.

- [Changelog](CHANGELOG.md) of the project.
- [License](LICENSE) of the project.
- [Code of Conduct](CODE_OF_CONDUCT.md) of the project.
- [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.
