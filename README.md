# [WIP] Deploying a Multi-LLM and Multi-RAG Powered Chatbot Using AWS CDK on AWS
[![Release Notes](https://img.shields.io/github/v/release/aws-samples/aws-genai-llm-chatbot)](https://github.com/aws-samples/aws-genai-llm-chatbot/releases)
[![GitHub star chart](https://img.shields.io/github/stars/aws-samples/aws-genai-llm-chatbot?style=social)](https://star-history.com/#aws-samples/aws-genai-llm-chatbot)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

![sample](assets/chabot-sample.gif "AWS GenAI Chatbot")

## Table of content
- [Features](#features)
- [Precautions](#precautions)
- [Preview Access and Service Quotas](#preview-access-and-service-quotas)
- [Deploy](#deploy)
- [Clean up](#clean-up)
- [Authors](#authors)
- [Credits](#credits)
- [License](#license)


# Features
## Modular, comprehensive and ready to use
This solution provides ready-to-use code so you can start **experimenting with a variety of Large Language Models, settings and prompts.** in your own AWS account.

Supported models providers:
- [Amazon Bedrock](https://aws.amazon.com/bedrock/) 
- [Amazon SageMaker](https://aws.amazon.com/sagemaker/) self hosted models from Foundation, Jumpstart and HuggingFace.
- Third party providers via API such as Anthropic, Cohere, AI21 Labs, OpenAI, etc. [See available langchain integrations](https://python.langchain.com/docs/integrations/llms/) for a comprehensive list.


## Experiment multiple RAG options with Workspaces
![sample](assets/create-workspace-sample.gif "AWS GenAI Chatbot")

## Unlock RAG potentials with Workspaces Debugging Tools
![sample](assets/workspace-debug-sample.gif "AWS GenAI Chatbot")


## Full-fledged User Interface
The repository includes a CDK construct to deploy  a **full-fledged UI** built with [React](https://react.dev/) to interact with the deployed LLMs as chatbots. Hosted on [Amazon S3](https://aws.amazon.com/s3/) and distributed with [Amazon CloudFront](https://aws.amazon.com/cloudfront/). Protected with [Amazon Cognito Authentication](https://aws.amazon.com/cognito/) to help you interact and experiment with multiple LLMs, multiple RAG sources, conversational history support and documents upload.
The interface layer between the UI and backend is built with [Amazon API Gateway WebSocket APIs](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-websocket-api.html).


Build on top of [AWS Cloudscape Design System](https://cloudscape.design/).


# Precautions

Before you begin using the solution, there are certain precautions you must take into account:

- **Cost Management with self hosted models on SageMaker**: Be mindful of the costs associated with AWS resources, especially with SageMaker models which are billed by the hour. While the sample is designed to be cost-effective, leaving serverful resources running for extended periods or deploying numerous LLMs can quickly lead to increased costs.

- **Licensing obligations**: If you choose to use any datasets or models alongside the provided samples, ensure you check LLM code and comply with all licensing obligations attached to them.

- **This is a sample**: the code provided as part of this repository shouldn't be used for production workloads without further reviews and adaptation.


# Deploy

We are providing a tool that guides you in the configuration of the solution.

### Environment setup

Verify that your environment satisfies the following prerequisites:

You have:

1. An [AWS account](https://aws.amazon.com/premiumsupport/knowledge-center/create-and-activate-aws-account/)
2. `AdministratorAccess` policy granted to your AWS account (for production, we recommend restricting access as needed)
3. Both console and programmatic access
4. [NodeJS 16 or 18](https://nodejs.org/en/download/) installed
    - If you are using [`nvm`](https://github.com/nvm-sh/nvm) you can run the following before proceeding
    - ```
      nvm install 16 && nvm use 16

      or

      nvm install 18 && nvm use 18
      ```
5. [AWS CLI](https://aws.amazon.com/cli/) installed and configured to use with your AWS account
6. [Typescript 3.8+](https://www.typescriptlang.org/download) installed
7. [AWS CDK CLI](https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html) installed
8. [Docker](https://docs.docker.com/get-docker/) installed
   - N.B. [`buildx`](https://github.com/docker/buildx) is also required. For Windows and macOS `buildx` [is included](https://github.com/docker/buildx#windows-and-macos) in [Docker Desktop](https://docs.docker.com/desktop/)
10. [Python 3+](https://www.python.org/downloads/) installed


### (Optional) If using AWS Cloud9
If you'd like to use [AWS Cloud9](https://aws.amazon.com/cloud9/) to deploy the solution from you will need the following before proceeding:
- at least `m5.large` as Instance type.
- use `Ubuntu` as the platform.
- increase the instance's EBS volume size to at least 100GB. 
To do this, run the following commands from the Cloud9 terminal:
```
sh ./scripts/cloud9-resize.sh 100
```
 See the documentation for more details [on enviroment resize here](https://docs.aws.amazon.com/cloud9/latest/user-guide/move-environment.html#move-environment-resize). 

### Deployment

1. Clone the repository
```bash
git clone https://github.com/aws-samples/aws-genai-llm-chatbot
```
2. Move into the cloned repository
```bash
cd aws-genai-llm-chatbot
```
```bash
git checkout v3-dev
```
3. Install the project dependencies and build the project by running this command
```bash
npm install && npm run build
```

4. Once done, run the magic-create CLI to help you set up the solution with the features you care most:
```bash
npm run create
```
You'll be prompted to configure the different aspects of the solution such as: 
- The LLMs to enable (we support all models provided by Bedrock, FalconLite, LLama 2 and more to come)
- Setup of the RAG system: engine selection (i.e. Aurora w/ pgvector, OpenSearch, Kendra..) embeddings selection and more to come.

When at done, answer `Y` to create a new configuration.

![sample](assets/magic-create-sample.gif "CLI sample")

You're configuration is now stored under `bin/config.json`, you can re-run the magic-create command to as needed to update your `config.json`

5. (Optional) Bootstrap AWS CDK on the target account and regioon

> **Note**: This is required if you have never used AWS CDK before on this account and region combination. ([More information on CDK bootstrapping](https://docs.aws.amazon.com/cdk/latest/guide/cli.html#cli-bootstrap)).

```bash
npx cdk bootstrap aws://{targetAccountId}/{targetRegion}
```

You can now deploy by running:

```bash
npx cdk deploy
```
> **Note**: This step duration can vary a lot, depending on the Constructs you are deploying.

You can view the progress of your CDK deployment in the [CloudFormation console](https://console.aws.amazon.com/cloudformation/home) in the selected region.

6. Once deployed, take note of the `User Interface`, `User Pool` and, if you want to interact with [3P models providers](#3p-models-providers) the `Secret` that will, eventually, hold the various `API_KEYS` should you want to experiment with 3P providers.  

```bash
...
Outputs:
GenAIChatBotStack.UserInterfaceUserInterfaceDomanNameXXXXXXXX = dxxxxxxxxxxxxx.cloudfront.net
GenAIChatBotStack.AuthenticationUserPoolLinkXXXXX = https://xxxxx.console.aws.amazon.com/cognito/v2/idp/user-pools/xxxxx_XXXXX/users?region=xxxxx
GenAIChatBotStack.ApiKeysSecretNameXXXX = ApiKeysSecretName-xxxxxx
...
```

7. Open the generated **Cognito User Pool** Link from outputs above i.e. `https://xxxxx.console.aws.amazon.com/cognito/v2/idp/user-pools/xxxxx_XXXXX/users?region=xxxxx`

8. Add a user that will be used to login into the web interface.

9. Open the `User Interface` Url frin the outputs above i.e. `dxxxxxxxxxxxxx.cloudfront.net`

10. Login with the user created in .6, you will be asked to change the password and you'll be logged in in the main page.


# Clean up
You can remove the stacks and all the associated resources created in your AWS account by running the following command:

```bash
npx cdk destroy
```

# Authors
- [Bigad Soleiman](https://www.linkedin.com/in/bigadsoleiman/)
- [Sergey Pugachev](https://www.linkedin.com/in/spugachev/)


# Credits

This sample was made possible thanks to the following libraries:
- [langchain](https://python.langchain.com/docs/get_started/introduction.html) from [LangChain AI](https://github.com/langchain-ai)
- [unstructured](https://github.com/Unstructured-IO/unstructured) from [Unstructured-IO](https://github.com/Unstructured-IO/unstructured)
- [pgvector](https://github.com/pgvector/pgvector) from [Andrew Kane](https://github.com/ankane)

# License

This library is licensed under the MIT-0 License. See the LICENSE file.

- [Changelog](CHANGELOG.md) of the project.
- [License](LICENSE) of the project.
- [Code of Conduct](CODE_OF_CONDUCT.md) of the project.
- [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.
