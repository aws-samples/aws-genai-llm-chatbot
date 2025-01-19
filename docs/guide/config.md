# Configuration
When deploying the project, you will generate a config file. This page aims to explain the options.

Before you start, please read the [precautions](../documentation/precautions.md) and [security](../documentation/security.md) pages.

The configuration will allow you to define what AWS resource to create. To get an overview of what resource is required or optional, please refer to the [resource page](../about/aws-resources-deployed.md).

### Prefix
Set a prefix to the resource names including the CloudFormation stack name. It is usefull if you plan to deploy this project multiple times in the same AWS account and region.

### Use an existing Amazon VPC
Add the project to an existing [Amazon Virtual Private Cloud (Amazon VPC)](https://docs.aws.amazon.com/vpc/latest/userguide/what-is-amazon-vpc.html). Note the VPC has to have private subnets that can connect to the Internet. (For example when crawling a website to populate a RAG Workspace.)

If enabled, you will need to specify the VpcID. (Can be found [in the console](https://us-east-1.console.aws.amazon.com/vpcconsole/home#vpcs:) or using [the CLI](https://docs.aws.amazon.com/cli/latest/reference/ec2/describe-vpcs.html)).

If disabled, it will create a new VPC with one [NAT Gateway](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-nat-gateway.html) and the [VPC Flow logs](https://docs.aws.amazon.com/vpc/latest/userguide/flow-logs.html) enabled.

### Create KMS Customer managed Keys (CMK)
When enabled, the project will create 2 [Customer managed Keys](https://docs.aws.amazon.com/kms/latest/developerguide/concepts.html#key-mgmt) that will be used when possitble to encrypt the date at rest.

### Retain on Delete
When enabled, every resource storing data will be [retained on delete](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-attribute-deletionpolicy.html) (For example a log group, an S3 bucket, a table...). This means, on cleanup it will skip the deletion of these AWS resources. 

This capability is recommended to prevent data deletion.

### Enable Amazon Bedrock
If [Amazon Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/what-is-bedrock.html) is enabled, the fundation models available in Bedrock will be available. Note, to be usable, the models [have to be enabled](https://docs.aws.amazon.com/bedrock/latest/userguide/model-access-modify.html). Please refer to the [models requirements](../documentation/model-requirements.md) for more information.

### Enable Amazon Bedrock Guardrails
[Amazon Bedrock Guardrails](https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails.html) can be leveraged to implement safeguards when using functional models provided by Amazon Bedrock. To use this feature, you will first need to create and configure a [guardrail](https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails-create.html).

At this time, the Guardrails configuration is not created by the project. Please use [the console](https://aws.amazon.com/blogs/machine-learning/introducing-guardrails-in-knowledge-bases-for-amazon-bedrock/) or create your own [configuration using CDK](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_bedrock.CfnGuardrail.html).

Once it is configured, you will need to provide the ID of the Guardrail and the version. If you select [DRAFT as a version](https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails-test.html), it will use the working draft that can be changed without requiring a new deployment.

### Use Amazon SageMaker models
Enabling [Amazon SageMaker](https://docs.aws.amazon.com/sagemaker/latest/dg/whatis.html) will deploy a SageMaker endpoint for each model selected. For more details about this feature please refer to the [self hosted models documentation](../documentation/self-hosted-models.md)  and the [models requirements](../documentation/model-requirements.md).

Creating SageMaker endpoints have cost implication because they are not serverless resource and you will need to verify the license requirements of the models you plan to use.

As a cost saving option, the configuration allows you to run the endpoints on a schedule. For more details, please refer to [the folliwng page](../documentation/sagemaker-schedule.md). Please note if you attempt to re-deploy while the endpoints are not running, it will cause a failure.

In addition, if the model source is HuggingFace, it might require authetication. For more detauls please refer to the [models requirements](../documentation/model-requirements.md).

Please note as an alternative managed by AWS, the project supports [AWS Jumpstart](https://aws.amazon.com/sagemaker/jumpstart/) for the models `Mistral-7B-Instruct-v0.3` and `meta-LLama2-13b-chat`

## Enable Retrieval-augmented generation (RAG)
Enabling this option will allow you to create workspaces, upload documents and websites. When using the Chatbot, a workspace can be used to give more information to the model.

### Deploy default embedding and cross-encoder models via SageMaker

When RAG is enabled, you can enable this option to deploy an Amazon SageMaker endpoint providing re-ranking capabilities and embeding generation.

The models available when deploying the default endpoint are [intfloat/multilingual-e5-large](https://huggingface.co/intfloat/multilingual-e5-large), [sentence-transformers/all-MiniLM-L6-v2](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2) and [cross-encoder/ms-marco-MiniLM-L-12-v2](https://huggingface.co/cross-encoder/ms-marco-MiniLM-L-12-v2). If enable, please consider the cost of using SageMaker and the  the [models requirements](../documentation/model-requirements.md).

For more information about this default endpoint and how to update the models, please refer to [the following page.](../documentation/inference-script.md)

### Select RAG Workspaces engines
Four engines are available by default (each of them is optional)
* [Amazon Kendra](https://docs.aws.amazon.com/kendra/latest/dg/what-is-kendra.html). 
  * You can use an existing index instead of creating one.
  * If creating a new index, you can select to use the [Entreprise edition](https://docs.aws.amazon.com/kendra/latest/dg/what-is-kendra.html#kendra-editions). If not it will use the Developer edition.
  * The name of the index will be used to show it in the Front End application
* Amazon Aurora PostgreSQL w/ pgvector data store. This option will create an [Aurora Serverless v2 cluster](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2.html).
* [Amazon OpenSearch Serverless Service](https://docs.aws.amazon.com/opensearch-service/latest/developerguide/serverless.html).
* [Amazon Bedrock Knowledge Base]. If selected, you will have to create the knowledge based as defined [in the documentation](https://docs.aws.amazon.com/bedrock/latest/userguide/knowledge-base-resource.html) and provide the ID. The project only supports Amazon Bedrock Knowledge Bases that are already created. (Either manually or [programmatically with CDK](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_bedrock.CfnKnowledgeBase.html) for example)

If Amazon Aurora or OpenSearch is selected, you will also need to select a default embeding models to generate the vectors. To use a serverless option, Amazon Bedrock support the [Titan embeding models](https://docs.aws.amazon.com/bedrock/latest/userguide/titan-embedding-models.html).

For more details, please refer to the [document retrieval](../documentation/retriever.md) which explain how to add additional engines.

## Advanced settings
### API Throttling
To protect the environment against sudden traffic increase, the project throttle incoming requests by IP using [AWS WAF rate limit rules](https://docs.aws.amazon.com/waf/latest/developerguide/waf-rule-statement-type-rate-based.html). As part of the configuration, you can select 2 threholds:
* Rate limit per IP on the `SendQuery` mutation invoking the Large Language models.
* Rate limit per IP on all the GraphQL APIs.

Please note the throttling rules are based on the IP. Theses limits could be an issue if you users are all using the same IP.

### Log retention
Defines how long the application and access logs are retained. For more information [about logging.](https://docs.aws.amazon.com/wellarchitected/2023-04-10/framework/sec_detect_investigate_events_app_service_logging.html)

### Advanced monitoring
When enabled, it will create alarms, models metrics and enable AWS X-Ray. For more information, please refer to [the monitoring page](../documentation/monitoring.md)

### Create VPC Endpoints
[A VPC endpoint](https://docs.aws.amazon.com/whitepapers/latest/aws-privatelink/what-are-vpc-endpoints.html) allows you to privately connect your VPC to supported AWS services. By enabling this option, it will create VPC Endpoints for the following AWS services: S3, DynamoDB, Secret Manager, SageMaker, AppSync, Lambda, SNS, Step Functions, SSM, KMS, Bedrock, Kendra, RDS, ECS, Batch, EC2.

Using this capability improves the security and [could reduce the cost based on your usage](https://aws.amazon.com/blogs/architecture/reduce-cost-and-increase-security-with-amazon-vpc-endpoints/). However, VPC endpoints are persitent resources, please consider the [cost](https://aws.amazon.com/privatelink/pricing/) when using this capability.

### Private Website (Front-End only)
By enabling this setting, it will deploy the front-end inside of the VPC using an internal Application Load Balancer [similar to the solution described here](https://aws.amazon.com/blogs/networking-and-content-delivery/hosting-internal-https-static-websites-with-alb-s3-and-privatelink/). This option can be relevant if you plan to access the chatbot privately (Via a VPN for example).

Please note if it is disable, it will deploy the front end to [Amazon CloudFront](https://aws.amazon.com/cloudfront/)

For more information about this feature and how to set it up, please refer to [the following page.](../documentation/private-chatbot.md)

### Custom Domain
When using this change, it will attach a certificate to either the Amazon CloudFront disribution or the Application Load Balancer (if private website is used).

To use this capability, you will first need to create [the certificate](https://docs.aws.amazon.com/acm/latest/userguide/gs.html) and provide its ARN once it is active.

Then you will need to create a DNS record to point the resource. If Amazon Cloudfront is used please refer to the [documentation](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/routing-to-cloudfront-distribution.html#routing-to-cloudfront-distribution-config). If a private website is used, please refer to this [documentation](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/routing-to-elb-load-balancer.html#routing-to-elb-load-balancer-configuring).

Please refer to [the documentation](../documentation/custom-public-domain.md) for more details

### Geo restrinction
When `Private Website` is disabled, you can restrict access per location using [Amazon CloudFront capability](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/georestrictions.html#georestrictions-cloudfront).  For more detais, please refer to [the geo restriction page](../documentation/cf-geo-restriction.md).


### Cognito Federation
The project relies on Amazon Cognito and support federation using external identity providers (using OpenID Connect (OIDC) and SAML 2.0). To enable this feature, please refer to [the federation page](../documentation/cognito/overview.md).

