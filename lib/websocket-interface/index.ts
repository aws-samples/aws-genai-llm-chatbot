import * as path from 'path';

import * as apigwv2 from '@aws-cdk/aws-apigatewayv2-alpha';
import { WebSocketLambdaAuthorizer } from '@aws-cdk/aws-apigatewayv2-authorizers-alpha';
import { WebSocketLambdaIntegration } from '@aws-cdk/aws-apigatewayv2-integrations-alpha';
import * as python from '@aws-cdk/aws-lambda-python-alpha';
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

interface WebSocketInterfaceProps extends cdk.NestedStackProps {
  messagesTopic: sns.Topic;
}

export class WebSocketInterface extends Construct {
  public readonly webSocketApiUrl: string;
  public readonly webSocketApiCallbackUrl: string;
  public readonly outgoingMessagesQueue: sqs.Queue;

  constructor(scope: Construct, id: string, props: WebSocketInterfaceProps) {
    super(scope, id);

    const { messagesTopic } = props;

    const powertoolsArn = `arn:aws:lambda:${cdk.Aws.REGION}:017000801446:layer:AWSLambdaPowertoolsPythonV2:39`;
    const powertoolsLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'PowertoolsLayer', powertoolsArn);

    const defaultEnvironmentVariables = {
      POWERTOOLS_DEV: 'true',
      POWERTOOLS_SERVICE_NAME: 'Chatbot',
      POWERTOOLS_METRICS_NAMESPACE: 'WebSocketInterface',
    };

    const connectionsTable = new dynamodb.Table(this, 'ConnectionsTable', {
      partitionKey: {
        name: 'connectionId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    connectionsTable.addGlobalSecondaryIndex({
      indexName: 'byUser',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
    });

    const connectionHandlerFunction = new python.PythonFunction(this, 'ConnectionHandlerFunction', {
      entry: path.join(__dirname, './functions/connection-handler'),
      runtime: lambda.Runtime.PYTHON_3_11,
      tracing: lambda.Tracing.ACTIVE,
      layers: [powertoolsLayer],
      environment: {
        ...defaultEnvironmentVariables,
        CONNECTIONS_TABLE_NAME: connectionsTable.tableName,
      },
    });
    connectionsTable.grantReadWriteData(connectionHandlerFunction);

    const authorizerFunction = new python.PythonFunction(this, 'AuthorizerFunction', {
      entry: path.join(__dirname, './functions/authorizer'),
      runtime: lambda.Runtime.PYTHON_3_11,
      tracing: lambda.Tracing.ACTIVE,
      layers: [powertoolsLayer],
      environment: {
        ...defaultEnvironmentVariables,
      },
    });

    const webSocketApi = new apigwv2.WebSocketApi(this, 'WebSocketApi', {
      connectRouteOptions: {
        authorizer: new WebSocketLambdaAuthorizer('Authorizer', authorizerFunction, {
          identitySource: ['route.request.querystring.token'],
        }),
        integration: new WebSocketLambdaIntegration('ConnectIntegration', connectionHandlerFunction),
      },
      disconnectRouteOptions: {
        integration: new WebSocketLambdaIntegration('DisconnectIntegration', connectionHandlerFunction),
      },
    });

    const stage = new apigwv2.WebSocketStage(this, 'WebSocketApiStage', {
      webSocketApi,
      stageName: 'prod',
      autoDeploy: true,
    });

    const incomingMessageHandlerFunction = new python.PythonFunction(this, 'IncomingMessageHandlerFunction', {
      entry: path.join(__dirname, './functions/incoming-message-handler'),
      runtime: lambda.Runtime.PYTHON_3_11,
      tracing: lambda.Tracing.ACTIVE,
      layers: [powertoolsLayer],
      environment: {
        ...defaultEnvironmentVariables,
        MESSAGES_TOPIC_ARN: messagesTopic.topicArn,
        WEBSOCKET_API_ENDPOINT: stage.callbackUrl,
      },
    });
    messagesTopic.grantPublish(incomingMessageHandlerFunction);
    incomingMessageHandlerFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['events:PutEvents'],
        resources: [`arn:aws:events:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:event-bus/default`],
      }),
    );
    incomingMessageHandlerFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['execute-api:ManageConnections'],
        resources: [`arn:aws:execute-api:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:${webSocketApi.apiId}/${stage.stageName}/*/*`],
      }),
    );

    webSocketApi.addRoute('$default', {
      integration: new WebSocketLambdaIntegration('DefaultIntegration', incomingMessageHandlerFunction),
    });

    const outgoingMessageHandlerFunction = new python.PythonFunction(this, 'OutgoingMessageFunction', {
      entry: path.join(__dirname, './functions/outgoing-message-handler'),
      runtime: lambda.Runtime.PYTHON_3_11,
      tracing: lambda.Tracing.ACTIVE,
      layers: [powertoolsLayer],
      environment: {
        ...defaultEnvironmentVariables,
        WEBSOCKET_API_ENDPOINT: stage.callbackUrl,
        CONNECTIONS_TABLE_NAME: connectionsTable.tableName,
      },
    });
    connectionsTable.grantReadData(outgoingMessageHandlerFunction);
    outgoingMessageHandlerFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['execute-api:ManageConnections'],
        resources: [`arn:aws:execute-api:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:${webSocketApi.apiId}/${stage.stageName}/*/*`],
      }),
    );

    const deadLetterQueue = new sqs.Queue(this, 'OutgoingMessagesDLQ.fifo', {
      fifo: true,
    });
    const queue = new sqs.Queue(this, 'OutgoingMessagesQueue.fifo', {
      fifo: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      deadLetterQueue: {
        queue: deadLetterQueue,
        maxReceiveCount: 3,
      },
    });
    // grant eventbridge permissions to send messages to the queue
    queue.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ['sqs:SendMessage'],
        resources: [queue.queueArn],
        principals: [new iam.ServicePrincipal('events.amazonaws.com'), new iam.ServicePrincipal('sqs.amazonaws.com')],
      }),
    );

    outgoingMessageHandlerFunction.addEventSource(new lambdaEventSources.SqsEventSource(queue));

    this.webSocketApiUrl = stage.url;
    this.webSocketApiCallbackUrl = stage.callbackUrl;
    this.outgoingMessagesQueue = queue;
  }
}
