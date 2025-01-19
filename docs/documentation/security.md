# Security

When you build systems on AWS infrastructure, security responsibilities are shared between you and AWS. [This shared responsibility model](https://aws.amazon.com/compliance/shared-responsibility-model/) reduces your operational burden because AWS operates, manages, and controls the components including the host operating system, the virtualization layer, and the physical security of the facilities in which the services operate. For more information about AWS security, visit [AWS Cloud Security.](https://aws.amazon.com/security/)

## Disclaimer
Sample code, software libraries, command line tools, proofs of concept, templates, or other related technology are provided as AWS Content or Third-Party Content under the AWS Customer Agreement, or the relevant written agreement between you and AWS (whichever applies). You should not use this AWS Content or Third-Party Content in your production accounts, or on production or other critical data. You are responsible for testing, securing, and optimizing the AWS Content or Third-Party Content, such as sample code, as appropriate for production grade use based on your specific quality control practices and standards. Deploying AWS Content or Third-Party Content may incur AWS charges for creating or using AWS chargeable resources, such as running Amazon EC2 instances or using Amazon S3 storage.

## Security best practices

The project is designed with security best practices in mind. However, the security of a solution differs based on your use case and the configuration used.

For further guidance on securing your application, refer to the [Security Pillar of the AWS Well-Architected Framework](https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/welcome.html) and  the [AWS Cloud Adoption Framework for Artificial Intelligence, Machine Learning, and Generative AI](https://docs.aws.amazon.com/whitepapers/latest/aws-caf-for-ai/security-perspective-compliance-and-assurance-of-aiml-systems.html).

The following are additional recommendations to enhance the security posture of the deployed solution:

### Network configuration
If you plan to use an existing Amazon VPC, please refer to [the best practices documentation](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-security-best-practices.html).

### Encryption
As part of the [configuration](../guide/config.md), you can enable the use of KMS Customer managed Keys (CMK) to encrypt your data at rest. Using this capability is recommended. Please refer to the [best practices documentation](https://docs.aws.amazon.com/prescriptive-guidance/latest/encryption-best-practices/general-encryption-best-practices.html)

**A Note on Encryption at Rest for Amazon Aurora**
If you are using Amazon Aurora with pgvector as a RAG source, encryption is **not** enabled unless KMS Customer managed Keys (CMK) are enabled in the configuration. Encryption adds an additional layer of data protection by securing your data from unauthorized access to the underlying storage.

It is strongly recommended to enable the CMK option when using Amazon Aurora to enable the encryption.

Note you cannot convert an unencrypted Aurora DB cluster to an encrypted one. To migrate an existing cluster, you will need to export the data, enable encryption (which will create new cluster) and then load the data. For more details, please refer to the [import](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/PostgreSQL.Procedural.Importing.html) and [export](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/postgresql-s3-export.html) documentation of RDS.

### Logging and resource retention
As part of the [configuration](../guide/config.md), you can define if resources are kept on cleanup to prevent losing data and for how long to store the logs. For more information about logging, please refer to the [documentation.](https://docs.aws.amazon.com/wellarchitected/2023-04-10/framework/sec_detect_investigate_events_app_service_logging.html).

### Foundation models and providers
Before using any model, we recommend to review the licensing, secrutiy and cost involved. For more information, please refer to [model usage page](./self-hosted-models.md). Please note enabling any SageMaker model with the exception of `Mistral-7B-Instruct-v0.3` would be fetched from the third party provider HuggingFace.

### Enable Amazon Bedrock Guardrails
It is recommended to enable guardrails as part of the [configuration](../guide/config.md) to implement safeguards for your generative AI applications based on your use cases and responsible AI policies. For more details please [refer to the documentation](https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails.html)

### Document processing
The project leverage the [Unstructured Docker iamge](https://docs.unstructured.io/open-source/introduction/overview) to process document such as PDFs. Before using Amazon Aurora or Amazon OpenSearch RAG engines, please review the use of this project.

As an alternative, you can use managed AWS Services as engines to handle the processing of documents. To do this, only enable Amazon Kendra or Amazon Bedrock Knowledge RAG engine during the [configuration](../guide/config.md) of the project.

### Throttling
To protect the environment against sudden traffic increase, the project throttle incoming requests by IP using [AWS WAF rate limit rules](https://docs.aws.amazon.com/waf/latest/developerguide/waf-rule-statement-type-rate-based.html). You can set the rate as part of the project [configuration](../guide/config.md). For more details on this topic, please refer to [the best practices](https://docs.aws.amazon.com/whitepapers/latest/aws-best-practices-ddos-resiliency/aws-best-practices-ddos-resiliency.html).

### Cognito configuration
This solution creates a Cognito user pool. MFA is not activated by default; however, we recommend using MFA for users in Cognito for a stronger security posture in production workloads.

If you plan to plan to use [federation](../documentation/cognito/overview.md), the project will assign user roles based on the user attributes. Please read the [Cognito documentation](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-identity-federation.html) before setting it up.

For more information about Cognito security features, please refer to [the following documentation](https://docs.aws.amazon.com/cognito/latest/developerguide/managing-security.html).

### Custom CloudFront domain
It is recommend to set up a custom domain as part of the [configuration](../guide/config.md). The CloudFront distribution default endpoint would set the security policy to TLS v1. It is recommended to set up a custom domain as part of the configuration to the more secured TLS v1.2 2021 policy. For more details please refer to the [documentation](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/distribution-web-values-specify.html#DownloadDistValues-security-policy).

When enabling private websites in the [configuration](../guide/config.md), it will create an internal Application Load Balancer to provide the front-end instead of using a Amazon CloudFront discutribtion. It is recommend to review the configuration of the private website setup to verify it meets your security standards. For more information please refer [to the documentation](https://docs.aws.amazon.com/elasticloadbalancing/latest/userguide/infrastructure-security.html).

## Automated Scans
To ensure the security of the project, a number of automated tools have been utilized. Information on each can be found below.

These scans run as github actions and need to pass to merge any pull request.

### JavaScript/TypeScript

#### npm-audit
The audit command for npm (`npm audit`) reports on known vulnerabilities of dependencies configured in a project.

### Python
#### Bandit
[Bandit](https://bandit.readthedocs.io/en/latest/) is a tool designed to find common security issues in Python code. Bandit has been run against the Python files written for this project. 

#### pip-audit
The audit command for pip reports on known vulnerabilities of dependencies configured in a project.


### CDK Templates
#### cdk_nag
[cdk_nag](https://github.com/cdklabs/cdk-nag/) checks CDK applications for best practices using a combination of available rule packs.

A number of rules have been suppressed. Each suppression is accompanied by a reason.
