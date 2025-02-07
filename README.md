# Building RAG use cases with GenAI Chatbot on AWS

[![Release Notes](https://img.shields.io/github/v/release/aws-samples/aws-genai-llm-chatbot)](https://github.com/aws-samples/aws-genai-llm-chatbot/releases)
[![GitHub star chart](https://img.shields.io/github/stars/aws-samples/aws-genai-llm-chatbot?style=social)](https://star-history.com/#aws-samples/aws-genai-llm-chatbot)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[![Deploy with GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://aws-samples.github.io/aws-genai-llm-chatbot/guide/deploy.html#deploy-with-github-codespaces)

[![Full Documentation](https://img.shields.io/badge/Full%20Documentation-blue?style=for-the-badge&logo=Vite&logoColor=white)](https://aws-samples.github.io/aws-genai-llm-chatbot/)

![sample](docs/about/assets/chabot-sample.gif "GenAI Chatbot on AWS")


## 🚀 NEW! Support for new Amazon Nova Models 🚀
### Deploy this chatbot to use the recently announced [Amazon Nova models](https://aws.amazon.com/blogs/aws/introducing-amazon-nova-frontier-intelligence-and-industry-leading-price-performance/)!
### These powerful models can __understand__ and __generate__ images and videos.

Deploy this chatbot to experiment with:
- `Amazon Nova Micro`
- `Amazon Nova Lite`
- `Amazon Nova Pro`
- `Amazon Nova Canvas`
- `Amazon Nova Reels`



Make sure to request access to the new models [here](https://aws-samples.github.io/aws-genai-llm-chatbot/documentation/model-requirements.html#amazon-bedrock-requirements)

Read more about the new models [here](https://www.aboutamazon.com/news/aws/amazon-nova-artificial-intelligence-bedrock-aws)

---


This solution provides ready-to-use code so you can start **experimenting with a variety of Large Language Models and Multimodal Language Models, settings and prompts** in your own AWS account.

Supported model providers:

- [Amazon Bedrock](https://aws.amazon.com/bedrock/) which supports a wide range of models from AWS, Anthropic, Cohere and Mistral including the latest models from Amazon Nova. See [Recent announcements](https://aws.amazon.com/blogs/aws/introducing-amazon-nova-frontier-intelligence-and-industry-leading-price-performance/) for more details.
- [Amazon SageMaker](https://aws.amazon.com/sagemaker/) self-hosted models from Foundation, Jumpstart and HuggingFace.
- Third-party providers via API such as Anthropic, Cohere, AI21 Labs, OpenAI, etc. [See available langchain integrations](https://python.langchain.com/docs/integrations/llms/) for a comprehensive list.

# Additional Resources

| Resource |Description|
|:-------------|:-------------|
| [Secure Messenger GenAI Chatbot](https://github.com/aws-samples/secure-messenger-genai-chatbot) | A messenger built on Wickr that can interface with this chatbot to provide Q&A service in tightly regulated environments (i.e. HIPAA). |
| [Project Lakechain](https://github.com/awslabs/project-lakechain) | A powerful cloud-native, AI-powered, document (docs, images, audios, videos) processing framework built on top of the AWS CDK. |
| [AWS Generative AI CDK Constructs](https://github.com/awslabs/generative-ai-cdk-constructs/) | Open-source library extension of the [AWS Cloud Development Kit (AWS CDK)](https://docs.aws.amazon.com/cdk/v2/guide/home.html)  aimed to help developers build generative AI solutions using pattern-based definitions for their architecture. |
| [Artifacts and Tools for Bedrock](https://github.com/aws-samples/artifacts-and-tools-for-bedrock) | An innovative chat-based user interface with support for tools and artifacts. It can create graphs and diagrams, analyze data, write games, create web pages, generate files, and much more.  |

# Roadmap

Roadmap is available through the [GitHub Project](https://github.com/orgs/aws-samples/projects/69)

# Authors

- [Bigad Soleiman](https://www.linkedin.com/in/bigadsoleiman/)
- [Sergey Pugachev](https://www.linkedin.com/in/spugachev/)

# Contributors
[![contributors](https://contrib.rocks/image?repo=aws-samples/aws-genai-llm-chatbot&max=2000)](https://github.com/aws-samples/aws-genai-llm-chatbot/graphs/contributors)

# License

This library is licensed under the MIT-0 License. See the LICENSE file.

- [Changelog](CHANGELOG.md) of the project.
- [License](LICENSE) of the project.
- [Code of Conduct](CODE_OF_CONDUCT.md) of the project.
- [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

Although this repository is released under the  MIT-0 license, its front-end and SQL implementation use the following third party projects:
- [psycopg2-binary](https://github.com/psycopg/psycopg2)
- [jackspeak](https://github.com/isaacs/jackspeak)
- [package-json-from-dist](https://github.com/isaacs/package-json-from-dist)
- [path-scurry](https://github.com/isaacs/path-scurry)

These projects' licensing includes the LGPL v3 and  BlueOak-1.0.0 licenses.

# Legal Disclaimer

You should consider doing your own independent assessment before using the content in this sample for production purposes. This may include (amongst other things) testing, securing, and optimizing the content provided in this sample, based on your specific quality control practices and standards.
