import * as cognito from "aws-cdk-lib/aws-cognito";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as sns from "aws-cdk-lib/aws-sns";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as iam from "aws-cdk-lib/aws-iam";
import * as cdk from "aws-cdk-lib";
import * as path from "path";
import { Construct } from "constructs";
import { RagEngines } from "../rag-engines";
import { Shared } from "../shared";
import { SageMakerModelEndpoint, SystemConfig } from "../shared/types";
import { ChatBotDynamoDBTables } from "./chatbot-dynamodb-tables";
import { ChatBotS3Buckets } from "./chatbot-s3-buckets";
import { ApiResolvers } from "./rest-api";
import { RealtimeGraphqlApiBackend } from "./websocket-api";
import * as appsync from "aws-cdk-lib/aws-appsync";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { RetentionDays } from "aws-cdk-lib/aws-logs";
import { NagSuppressions } from "cdk-nag";

export interface ChatBotApiProps {
  readonly shared: Shared;
  readonly config: SystemConfig;
  readonly ragEngines?: RagEngines;
  readonly userPool: cognito.UserPool;
  readonly modelsParameter: ssm.StringParameter;
  readonly models: SageMakerModelEndpoint[];
}

export class ChatBotApi extends Construct {
  public readonly messagesTopic: sns.Topic;
  public readonly outBoundQueue: sqs.Queue;
  public readonly sessionsTable: dynamodb.Table;
  public readonly byUserIdIndex: string;
  public readonly filesBucket: s3.Bucket;
  public readonly userFeedbackBucket: s3.Bucket;
  public readonly graphqlApi: appsync.GraphqlApi;
  public readonly resolvers: lambda.Function[] = [];

  constructor(scope: Construct, id: string, props: ChatBotApiProps) {
    super(scope, id);

    const chatTables = new ChatBotDynamoDBTables(this, "ChatDynamoDBTables", {
      kmsKey: props.shared.kmsKey,
      retainOnDelete: props.config.retainOnDelete,
    });
    const chatBuckets = new ChatBotS3Buckets(this, "ChatBuckets", {
      kmsKey: props.shared.kmsKey,
      retainOnDelete: props.config.retainOnDelete,
    });

    const loggingRole = new iam.Role(this, "apiLoggingRole", {
      assumedBy: new iam.ServicePrincipal("appsync.amazonaws.com"),
      inlinePolicies: {
        loggingPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ["logs:*"],
              resources: ["*"],
            }),
          ],
        }),
      },
    });

    const api = new appsync.GraphqlApi(this, "ChatbotApi", {
      name: "ChatbotGraphqlApi",
      definition: appsync.Definition.fromFile(
        path.join(__dirname, "schema/schema.graphql")
      ),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.USER_POOL,
          userPoolConfig: {
            userPool: props.userPool,
          },
        },
        additionalAuthorizationModes: [
          {
            authorizationType: appsync.AuthorizationType.IAM,
          },
        ],
      },
      logConfig: {
        fieldLogLevel: appsync.FieldLogLevel.INFO,
        retention: props.config.logRetention ?? RetentionDays.ONE_WEEK,
        role: loggingRole,
      },
      xrayEnabled: props.config.advancedMonitoring === true,
      visibility: props.config.privateWebsite
        ? appsync.Visibility.PRIVATE
        : appsync.Visibility.GLOBAL,
    });

    const apiResolvers = new ApiResolvers(this, "RestApi", {
      ...props,
      sessionsTable: chatTables.sessionsTable,
      byUserIdIndex: chatTables.byUserIdIndex,
      api,
      userFeedbackBucket: chatBuckets.userFeedbackBucket,
      filesBucket: chatBuckets.filesBucket,
    });

    this.resolvers.push(apiResolvers.appSyncLambdaResolver);

    const realtimeBackend = new RealtimeGraphqlApiBackend(this, "Realtime", {
      ...props,
      api,
      logRetention: props.config.logRetention,
      advancedMonitoring: props.config.advancedMonitoring,
    });

    this.resolvers.push(realtimeBackend.resolvers.sendQueryHandler);
    this.resolvers.push(realtimeBackend.resolvers.outgoingMessageHandler);

    realtimeBackend.resolvers.outgoingMessageHandler.addEnvironment(
      "GRAPHQL_ENDPOINT",
      api.graphqlUrl
    );

    api.grantMutation(realtimeBackend.resolvers.outgoingMessageHandler);

    // Prints out URL
    new cdk.CfnOutput(this, "GraphqlAPIURL", {
      value: api.graphqlUrl,
    });

    // Prints out the AppSync GraphQL API key to the terminal
    new cdk.CfnOutput(this, "Graphql-apiId", {
      value: api.apiId || "",
    });

    this.messagesTopic = realtimeBackend.messagesTopic;
    this.outBoundQueue = realtimeBackend.queue;
    this.sessionsTable = chatTables.sessionsTable;
    this.byUserIdIndex = chatTables.byUserIdIndex;
    this.userFeedbackBucket = chatBuckets.userFeedbackBucket;
    this.filesBucket = chatBuckets.filesBucket;
    this.graphqlApi = api;

    /**
     * CDK NAG suppression
     */
    NagSuppressions.addResourceSuppressions(loggingRole, [
      {
        id: "AwsSolutions-IAM5",
        reason:
          "Access to all log groups required for CloudWatch log group creation.",
      },
    ]);
  }
}
