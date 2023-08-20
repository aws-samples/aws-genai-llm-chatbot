import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3Notifications from 'aws-cdk-lib/aws-s3-notifications';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';

import { Authentication } from './authentication';
import { LangChainInterface } from './model-interfaces/langchain';
import { AuroraPgVector, OpenSearchVectorSearch, KendraSearch } from './rag-sources';
import { SageMakerModel, ContainerImages, DeploymentType } from './sagemaker-model';
import { UserInterface } from './user-interface';
import { Vpc } from './vpc';
import { WebSocketInterface } from './websocket-interface';

// Define common architecture and runtime for all lambda functions
// Before switching the architecture to ARM64, make sure to update all Dockerfiles FROM line to use the correct base image
const architecture = lambda.Architecture.X86_64;
const runtime = lambda.Runtime.PYTHON_3_11;

// Docker: Set default platform for commands that take the --platform flag
process.env.DOCKER_DEFAULT_PLATFORM=architecture.dockerPlatform


export class AwsGenaiLllmChatbotStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, {
      description: 'AWS LLM CHATBOT (uksb-1tupboc16)',
      ...props,
    });

    /* --- BASIC USAGE --- */

    // If you have access to bedrock, set up here the region and endpoint url
    const bedrockRegion = 'region';
    const bedrockEndpointUrl = 'https://endpoint-url';

    // VPC Construct
    // Create subnets for DBs and VPC endpoints
    const vpc = new Vpc(this, 'Vpc');

    // Authentication Construct
    const authentication = new Authentication(this, 'Authentication');

    // Create the main Message Topic acting as a message bus
    const messagesTopic = new sns.Topic(this, 'MessagesTopic', {
      fifo: true,
      contentBasedDeduplication: true,
    });

    // Websocket Interface Construct
    // This is the websocket interface for the chatbot to allow two way communication between the user interface and the model interface
    const websocketInterface = new WebSocketInterface(this, 'WebSocketInterface', {
      messagesTopic,
    });

    // Route all outgoing messages to the websocket interface queue
    messagesTopic.addSubscription(
      new subscriptions.SqsSubscription(websocketInterface.outgoingMessagesQueue, {
        filterPolicyWithMessageBody: {
          direction: sns.FilterOrPolicy.filter(
            sns.SubscriptionFilter.stringFilter({
              allowlist: ['OUT'],
            }),
          ),
        },
      }),
    );

    // Langchain Interface Construct - this is the model interface recieving messages from the websocket interface via the message topic
    // and interacting with the model via LangChain library
    const langchainInterface = new LangChainInterface(this, 'LangchainInterface', {
      messagesTopic,
      bedrockRegion,
      bedrockEndpointUrl,
      architecture,
      runtime,
    });

    // Route all incoming messages to the langchain model interface queue
    messagesTopic.addSubscription(
      new subscriptions.SqsSubscription(langchainInterface.ingestionQueue, {
        filterPolicyWithMessageBody: {
          direction: sns.FilterOrPolicy.filter(
            sns.SubscriptionFilter.stringFilter({
              allowlist: ['IN'],
            }),
          ),
        },
      }),
    );

    /* --- OPTIONAL: SELF HOSTED MODELS ON SAGEMAKER --- */
    /*
    // Falcon Lite example from HuggingFace
    const falconLite = new SageMakerModel(this, 'FalconLite', {
      vpc: vpc.vpc,
      region: this.region,
      model: {
        type: DeploymentType.Container,
        modelId: 'amazon/FalconLite',
        container: ContainerImages.HF_PYTORCH_LLM_TGI_INFERENCE_LATEST,
        instanceType: 'ml.g5.12xlarge',
        // https://github.com/awslabs/extending-the-context-length-of-open-source-llms/blob/main/custom-tgi-ecr/deploy.ipynb
        containerStartupHealthCheckTimeoutInSeconds: 600,
        env: {
          SM_NUM_GPUS: JSON.stringify(4),
          MAX_INPUT_LENGTH: JSON.stringify(12000),
          MAX_TOTAL_TOKENS: JSON.stringify(12001),
          HF_MODEL_QUANTIZE: 'gptq',
          TRUST_REMOTE_CODE: JSON.stringify(true),
          MAX_BATCH_PREFILL_TOKENS: JSON.stringify(12001),
          MAX_BATCH_TOTAL_TOKENS: JSON.stringify(12001),
          GPTQ_BITS: JSON.stringify(4),
          GPTQ_GROUPSIZE: JSON.stringify(128),
          DNTK_ALPHA_SCALER: JSON.stringify(0.25),
        },
      },
    });
    // Make model interface aware of the sagemaker endpoint and add the necessary permissions to the lambda function
    langchainInterface.addSageMakerEndpoint({
      name: 'FalconLite',
      endpoint: falconLite.endpoint,
    });
    /*
    // LLAMA V2 example from Jumpstart
    const llamav2 = new SageMakerModel(this, 'LLamaV2', {
      vpc: vpc.vpc,
      region: this.region,
      model: {
        type: DeploymentType.ModelPackage,
        modelId: 'meta-Llama2',
        instanceType: 'ml.g5.12xlarge',
        packages: (scope) =>
          new cdk.CfnMapping(scope, 'LlamaV2PackageMapping', {
            lazy: true,
            mapping: {
              'eu-west-1': { arn: 'arn:aws:sagemaker:eu-west-1:985815980388:model-package/llama2-13b-v3-8f4d5693a64a320ab0e8207af3551ae4' },
            },
          }),
      },
    });
    // Make model interface aware of the sagemaker endpoint and add the necessary permissions to the lambda function
    langchainInterface.addSageMakerEndpoint({
      name: 'LLamaV2',
      endpoint: llamav2.endpoint,
    });
    */

    /* --- OPTIONAL: RAG SECTION --- */
    /*
    // Create a topic for the data bucket this will act as a message bus only for uploaded/deleted documents
    const dataTopic = new sns.Topic(this, 'DataTopic');

    // This is the data bucket where all the documents will be uploaded to from user interface
    const dataBucket = new s3.Bucket(this, 'DataBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // allow authenticated web users to read upload data to the data bucket for their own files
    // ref: https://docs.amplify.aws/lib/storage/getting-started/q/platform/js/#using-amazon-s3
    authentication.identityPool.authenticatedRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject'],
        resources: [`${dataBucket.bucketArn}/public/*`, `${dataBucket.bucketArn}/protected/\${cognito-identity.amazonaws.com:sub}/*`, `${dataBucket.bucketArn}/private/\${cognito-identity.amazonaws.com:sub}/*`],
      }),
    );
    authentication.identityPool.authenticatedRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['s3:ListBucket'],
        resources: [`${dataBucket.bucketArn}`],
        conditions: {
          StringLike: {
            's3:prefix': ['public/', 'public/*', 'protected/', 'protected/*', 'private/${cognito-identity.amazonaws.com:sub}/', 'private/${cognito-identity.amazonaws.com:sub}/*'],
          },
        },
      }),
    );

    // Route all upload/delete events to the data topic
    dataBucket.addEventNotification(s3.EventType.OBJECT_CREATED, new s3Notifications.SnsDestination(dataTopic));
    dataBucket.addEventNotification(s3.EventType.OBJECT_REMOVED, new s3Notifications.SnsDestination(dataTopic));


    // RAG SOURCE: OpenSearch Vector Search Construct
    const openSearchVectorSearch = new OpenSearchVectorSearch(this, 'OpenSearchVectorSearch', {
      vpc: vpc.vpc,
      dataBucket: dataBucket,
      collectionName: 'genai-chatbot',
      indexName: 'docs',
      dimension: 4096, // 4096 is the default dimension for Amazon Titan Embeddings
      architecture,
      runtime,
      bedrockRegion,
      bedrockEndpointUrl,
    });
    // Subscribe the OpenSearch Vector Search ingestion queue to the data topic to receive upload/delete events and index the documents
    dataTopic.addSubscription(
      new subscriptions.SqsSubscription(openSearchVectorSearch.ingestionQueue, {
        // avoid SNS to add a wrapper around the message
        // ref: https://docs.aws.amazon.com/sns/latest/dg/sns-large-payload-raw-message-delivery.html
        rawMessageDelivery: true,
      }),
    );
    // Make model interface aware of the OpenSearch Vector Search Retriever API and add the necessary permissions to the lambda function
    langchainInterface.addRagSource({
      type: 'opensearchvectorsearch',
      api: openSearchVectorSearch.api,
    });

    // RAG SOURCE: Kendra Search Construct
    const kendraSearch = new KendraSearch(this, 'KendraSearch', {
      dataBucket: dataBucket,
      architecture,
      runtime,
      vpc: vpc.vpc,
    });
    // Subscribe the Kendra Search ingestion queue to the data topic to receive upload/delete events and index the documents
    dataTopic.addSubscription(
      new subscriptions.SqsSubscription(kendraSearch.ingestionQueue, {
        rawMessageDelivery: true,
      }),
    );
    // Make model interface aware of the Kendra Search Retriever API and add the necessary permissions to the lambda function
    langchainInterface.addRagSource({
      type: 'kendra',
      api: kendraSearch.api,
    });

    // RAG SOURCE: Aurora PG Vector Construct
    const auroraPgVector = new AuroraPgVector(this, 'AuroraPgVector', {
      vpc: vpc.vpc,
      dataBucket: dataBucket,
      architecture,
      runtime,
    });
    // Subscribe the Aurora PG Vector ingestion queue to the data topic to receive upload/delete events and index the documents
    dataTopic.addSubscription(
      new subscriptions.SqsSubscription(auroraPgVector.ingestionQueue, {
        rawMessageDelivery: true,
      }),
    );
    // Make model interface aware of the Aurora PG Vector Retriever API and add the necessary permissions to the lambda function
    langchainInterface.addRagSource({
      type: 'aurorapgvector',
      api: auroraPgVector.api,
    });
    
    /* --- USER INTERFACE --- */
    // User Interface Construct
    // This is the web interface for the chatbot
    const userInterface = new UserInterface(this, 'WebInterface', {
      userPoolId: authentication.userPool.userPoolId,
      userPoolClientId: authentication.userPoolClient.userPoolClientId,
      identityPoolId: authentication.identityPool.identityPoolId,
      webSocketApiUrl: websocketInterface.webSocketApiUrl,
      architecture,
      // dataBucket, // uncomment this line to enable file uploads from the user interface to the data bucket for RAG source(s)
    });

    // Enable cors for the data bucket to allow uploads from the user interface
    // ref: https://docs.amplify.aws/lib/storage/getting-started/q/platform/js/#amazon-s3-bucket-cors-policy-setup
    /*  
    dataBucket.addCorsRule({
      allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST, s3.HttpMethods.DELETE],
      allowedOrigins: [`https://${userInterface.distributionDomainName}`],
      // allowedOrigins: ['*'], // use this for local web development
      allowedHeaders: ['*'],
      exposedHeaders: ['x-amz-server-side-encryption', 'x-amz-request-id', 'x-amz-id-2', 'ETag'],
      maxAge: 3000,
    });
    */
  }
}
