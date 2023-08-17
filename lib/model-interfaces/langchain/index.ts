import * as path from 'path';

import * as python from '@aws-cdk/aws-lambda-python-alpha';
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';

import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import { CfnEndpoint } from 'aws-cdk-lib/aws-sagemaker';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

import { Layer } from '../../layer';

interface LangChainInterfaceProps extends cdk.NestedStackProps {
  messagesTopic: sns.Topic;
  bedrockRegion?: string;
  bedrockEndpointUrl?: string;
}

export class LangChainInterface extends Construct {
  public readonly ingestionQueue: sqs.Queue;
  public readonly requestHandler: python.PythonFunction;

  constructor(scope: Construct, id: string, props: LangChainInterfaceProps) {
    super(scope, id);

    const { messagesTopic, bedrockRegion, bedrockEndpointUrl } = props;

    const architecture = lambda.Architecture.ARM_64;
    const runtime = lambda.Runtime.PYTHON_3_11;

    // create secret for 3P models keys
    const keysSecrets = new secretsmanager.Secret(this, 'KeySecrets', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      secretObjectValue: {},
    });

    const commonLayer = new Layer(this, 'CommonLayer', {
      runtime,
      architecture,
      path: path.join(__dirname, './layers/common'),
    });

    const sessionsTable = new dynamodb.Table(this, 'SessionsTable', {
      partitionKey: {
        name: 'SessionId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'UserId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    const byUserIdIndex = 'byUserId';
    sessionsTable.addGlobalSecondaryIndex({
      indexName: byUserIdIndex,
      partitionKey: { name: 'UserId', type: dynamodb.AttributeType.STRING },
    });

    const requestHandler = new python.PythonFunction(this, 'RequestHandler', {
      entry: path.join(__dirname, './functions/request-handler'),
      runtime,
      architecture,
      tracing: lambda.Tracing.ACTIVE,
      timeout: cdk.Duration.minutes(15),
      memorySize: 1024,
      layers: [commonLayer.layer],
      environment: {
        SESSIONS_TABLE_NAME: sessionsTable.tableName,
        SESSIONS_BY_USER_ID_INDEX_NAME: byUserIdIndex,
        API_KEYS_SECRETS_ARN: keysSecrets.secretArn,
        MESSAGES_TOPIC_ARN: messagesTopic.topicArn,
        BEDROCK_REGION: bedrockRegion || '',
        BEDROCK_ENDPOINT_URL: bedrockEndpointUrl || '',
      },
    });

    messagesTopic.grantPublish(requestHandler);
    sessionsTable.grantReadWriteData(requestHandler);
    keysSecrets.grantRead(requestHandler);

    // Add Amazon Bedrock permissions to the IAM role for the Lambda function
    requestHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:*'],
        resources: ['*'],
      }),
    );

    const deadLetterQueue = new sqs.Queue(this, 'GenericModelDLQ.fifo', {
      fifo: true,
    });
    const queue = new sqs.Queue(this, 'GenericModelQueue.fifo', {
      fifo: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      // https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html#events-sqs-queueconfig
      visibilityTimeout: cdk.Duration.minutes(15 * 6),
      deadLetterQueue: {
        queue: deadLetterQueue,
        maxReceiveCount: 3,
      },
    });
    queue.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ['sqs:SendMessage'],
        resources: [queue.queueArn],
        principals: [new iam.ServicePrincipal('events.amazonaws.com'), new iam.ServicePrincipal('sqs.amazonaws.com')],
      }),
    );
    requestHandler.addEventSource(new lambdaEventSources.SqsEventSource(queue));

    this.ingestionQueue = queue;
    this.requestHandler = requestHandler;

    new cdk.CfnOutput(this, 'KeysSecretsName', {
      value: keysSecrets.secretName,
    });
  }

  public addRagSource({ api, type }: { api: apigateway.LambdaRestApi; type: string }) {
    // grant permission to invoke the api from the lambda function
    this.requestHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['execute-api:Invoke'],
        resources: [`${api.arnForExecuteApi()}`],
      }),
    );
    // clean type string from special characters spaces, dashes, underscores and dots
    const cleanType = type.replace(/[\s\.\-_]/g, '').toUpperCase();
    // add rag source to environment variables
    this.requestHandler.addEnvironment(`RAG_SOURCE_${cleanType}`, api.url);
  }

  public addSageMakerEndpoint({ endpoint, name }: { endpoint: CfnEndpoint; name: string }) {
    this.requestHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['sagemaker:InvokeEndpoint'],
        resources: [endpoint.ref],
      }),
    );
    const cleanName = name.replace(/[\s\.\-_]/g, '').toUpperCase();
    this.requestHandler.addEnvironment(`SAGEMAKER_ENDPOINT_${cleanName}`, endpoint.attrEndpointName);
  }
}
