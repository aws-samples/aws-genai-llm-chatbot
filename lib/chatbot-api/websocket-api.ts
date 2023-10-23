import * as apigwv2 from "@aws-cdk/aws-apigatewayv2-alpha";
import { WebSocketLambdaAuthorizer } from "@aws-cdk/aws-apigatewayv2-authorizers-alpha";
import { WebSocketLambdaIntegration } from "@aws-cdk/aws-apigatewayv2-integrations-alpha";
import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import * as path from "path";
import { Shared } from "../shared";
import { Direction } from "../shared/types";

interface WebSocketApiProps {
  readonly shared: Shared;
}

export class WebSocketApi extends Construct {
  public readonly api: apigwv2.WebSocketApi;
  public readonly messagesTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: WebSocketApiProps) {
    super(scope, id);

    // Create the main Message Topic acting as a message bus
    const messagesTopic = new sns.Topic(this, "MessagesTopic");

    const connectionsTable = new dynamodb.Table(this, "ConnectionsTable", {
      partitionKey: {
        name: "connectionId",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    connectionsTable.addGlobalSecondaryIndex({
      indexName: "byUser",
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
    });

    const connectionHandlerFunction = new lambda.Function(
      this,
      "ConnectionHandlerFunction",
      {
        code: lambda.Code.fromAsset(
          path.join(__dirname, "./functions/connection-handler")
        ),
        handler: "index.handler",
        runtime: props.shared.pythonRuntime,
        architecture: props.shared.lambdaArchitecture,
        tracing: lambda.Tracing.ACTIVE,
        layers: [props.shared.powerToolsLayer],
        environment: {
          ...props.shared.defaultEnvironmentVariables,
          CONNECTIONS_TABLE_NAME: connectionsTable.tableName,
        },
      }
    );

    connectionsTable.grantReadWriteData(connectionHandlerFunction);

    const authorizerFunction = new lambda.Function(this, "AuthorizerFunction", {
      code: lambda.Code.fromAsset(
        path.join(__dirname, "./functions/authorizer")
      ),
      handler: "index.handler",
      runtime: props.shared.pythonRuntime,
      architecture: props.shared.lambdaArchitecture,
      tracing: lambda.Tracing.ACTIVE,
      layers: [props.shared.powerToolsLayer],
      environment: {
        ...props.shared.defaultEnvironmentVariables,
      },
    });

    const webSocketApi = new apigwv2.WebSocketApi(this, "WebSocketApi", {
      connectRouteOptions: {
        authorizer: new WebSocketLambdaAuthorizer(
          "Authorizer",
          authorizerFunction,
          {
            identitySource: ["route.request.querystring.token"],
          }
        ),
        integration: new WebSocketLambdaIntegration(
          "ConnectIntegration",
          connectionHandlerFunction
        ),
      },
      disconnectRouteOptions: {
        integration: new WebSocketLambdaIntegration(
          "DisconnectIntegration",
          connectionHandlerFunction
        ),
      },
    });

    const stage = new apigwv2.WebSocketStage(this, "WebSocketApiStage", {
      webSocketApi,
      stageName: "socket",
      autoDeploy: true,
    });

    const incomingMessageHandlerFunction = new lambda.Function(
      this,
      "IncomingMessageHandlerFunction",
      {
        code: lambda.Code.fromAsset(
          path.join(__dirname, "./functions/incoming-message-handler")
        ),
        handler: "index.handler",
        runtime: props.shared.pythonRuntime,
        architecture: props.shared.lambdaArchitecture,
        tracing: lambda.Tracing.ACTIVE,
        layers: [props.shared.powerToolsLayer],
        environment: {
          ...props.shared.defaultEnvironmentVariables,
          MESSAGES_TOPIC_ARN: messagesTopic.topicArn,
          WEBSOCKET_API_ENDPOINT: stage.callbackUrl,
        },
      }
    );

    messagesTopic.grantPublish(incomingMessageHandlerFunction);
    incomingMessageHandlerFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["events:PutEvents"],
        resources: [
          `arn:${cdk.Aws.PARTITION}:events:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:event-bus/default`,
        ],
      })
    );

    incomingMessageHandlerFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["execute-api:ManageConnections"],
        resources: [
          `arn:${cdk.Aws.PARTITION}:execute-api:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:${webSocketApi.apiId}/${stage.stageName}/*/*`,
        ],
      })
    );

    webSocketApi.addRoute("$default", {
      integration: new WebSocketLambdaIntegration(
        "DefaultIntegration",
        incomingMessageHandlerFunction
      ),
    });

    const outgoingMessageHandlerFunction = new lambda.Function(
      this,
      "OutgoingMessageFunction",
      {
        code: lambda.Code.fromAsset(
          path.join(__dirname, "./functions/outgoing-message-handler")
        ),
        handler: "index.handler",
        runtime: props.shared.pythonRuntime,
        architecture: props.shared.lambdaArchitecture,
        tracing: lambda.Tracing.ACTIVE,
        layers: [props.shared.powerToolsLayer],
        environment: {
          ...props.shared.defaultEnvironmentVariables,
          WEBSOCKET_API_ENDPOINT: stage.callbackUrl,
          CONNECTIONS_TABLE_NAME: connectionsTable.tableName,
        },
      }
    );

    connectionsTable.grantReadData(outgoingMessageHandlerFunction);
    outgoingMessageHandlerFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["execute-api:ManageConnections"],
        resources: [
          `arn:${cdk.Aws.PARTITION}:execute-api:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:${webSocketApi.apiId}/${stage.stageName}/*/*`,
        ],
      })
    );

    const deadLetterQueue = new sqs.Queue(this, "OutgoingMessagesDLQ");

    const queue = new sqs.Queue(this, "OutgoingMessagesQueue", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      deadLetterQueue: {
        queue: deadLetterQueue,
        maxReceiveCount: 3,
      },
    });

    // grant eventbridge permissions to send messages to the queue
    queue.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ["sqs:SendMessage"],
        resources: [queue.queueArn],
        principals: [
          new iam.ServicePrincipal("events.amazonaws.com"),
          new iam.ServicePrincipal("sqs.amazonaws.com"),
        ],
      })
    );

    outgoingMessageHandlerFunction.addEventSource(
      new lambdaEventSources.SqsEventSource(queue)
    );

    // Route all outgoing messages to the websocket interface queue
    messagesTopic.addSubscription(
      new subscriptions.SqsSubscription(queue, {
        filterPolicyWithMessageBody: {
          direction: sns.FilterOrPolicy.filter(
            sns.SubscriptionFilter.stringFilter({
              allowlist: [Direction.Out],
            })
          ),
        },
      })
    );

    this.api = webSocketApi;
    this.messagesTopic = messagesTopic;
  }
}
