import * as cognito from "aws-cdk-lib/aws-cognito";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";
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
  public readonly sessionsTable: dynamodb.Table;
  public readonly byUserIdIndex: string;
  public readonly filesBucket: s3.Bucket;
  public readonly userFeedbackBucket: s3.Bucket;
  public readonly graphqlApi: appsync.GraphqlApi;

  constructor(scope: Construct, id: string, props: ChatBotApiProps) {
    super(scope, id);

    const chatTables = new ChatBotDynamoDBTables(this, "ChatDynamoDBTables");
    const chatBuckets = new ChatBotS3Buckets(this, "ChatBuckets");

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
        additionalAuthorizationModes: [
          {
            authorizationType: appsync.AuthorizationType.IAM,
          },
          {
            authorizationType: appsync.AuthorizationType.USER_POOL,
            userPoolConfig: {
              userPool: props.userPool,
            },
          },
        ],
      },
      logConfig: {
        fieldLogLevel: appsync.FieldLogLevel.ALL,
        retention: RetentionDays.ONE_WEEK,
        role: loggingRole,
      },
      xrayEnabled: true,
      visibility: props.config.privateWebsite ? appsync.Visibility.PRIVATE : appsync.Visibility.GLOBAL
    });

    new ApiResolvers(this, "RestApi", {
      ...props,
      sessionsTable: chatTables.sessionsTable,
      byUserIdIndex: chatTables.byUserIdIndex,
      api,
      userFeedbackBucket: chatBuckets.userFeedbackBucket,
    });

    const realtimeBackend = new RealtimeGraphqlApiBackend(this, "Realtime", {
      ...props,
      api,
    });

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
