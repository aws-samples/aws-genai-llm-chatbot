import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as sns from "aws-cdk-lib/aws-sns";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as iam from "aws-cdk-lib/aws-iam";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { RagEngines } from "../rag-engines";
import { Shared } from "../shared";
import { SageMakerModelEndpoint, SystemConfig } from "../shared/types";
import { ChatBotDynamoDBTables } from "./chatbot-dynamodb-tables";
import { ChatBotS3Buckets } from "./chatbot-s3-buckets";
import { RestApi } from "./rest-api";
import { WebSocketApi } from "./websocket-api";
import * as appsync from "aws-cdk-lib/aws-appsync";
import { RetentionDays } from "aws-cdk-lib/aws-logs";

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
  public readonly graphqlApi: appsync.GraphqlApi;

  constructor(scope: Construct, id: string, props: ChatBotApiProps) {
    super(scope, id);

    const chatTables = new ChatBotDynamoDBTables(this, "ChatDynamoDBTables");
    const chatBuckets = new ChatBotS3Buckets(this, "ChatBuckets");

    const restApi = new RestApi(this, "RestApi", {
      ...props,
      sessionsTable: chatTables.sessionsTable,
      byUserIdIndex: chatTables.byUserIdIndex,
    });

    const webSocketApi = new WebSocketApi(this, "WebSocketApi", props);

    // Using wildcards since with scoped down policies there were flaky errors
    const executionRole = new iam.Role(this, "mergedApiRole", {
      assumedBy: new iam.ServicePrincipal("appsync.amazonaws.com"),
      inlinePolicies: {
        sourceApisPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ["appsync:*"],
              resources: ["*"],
            }),
          ],
        }),
      },
    });

    const loggingRole = new iam.Role(this, "mergedApiLoggingRole", {
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

    const mergedApi = new appsync.GraphqlApi(this, "MergedApi", {
      name: "ChatbotGraphqlApi",
      definition: {
        sourceApiOptions: {
          sourceApis: [
            {
              sourceApi: webSocketApi.api.graphQLApi,
              description: "Realtime API",
            },
          ],
          mergedApiExecutionRole: executionRole,
        },
      },
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
    });

    new appsync.SourceApiAssociation(this, "RestApiAssociation", {
      mergedApi: mergedApi,
      mergedApiExecutionRole: executionRole,
      sourceApi: restApi.graphqlApi,
      mergeType: appsync.MergeType.AUTO_MERGE,
    });

    webSocketApi.api.outgoingMessageHandler.addEnvironment(
      "GRAPHQL_ENDPOINT",
      mergedApi.graphqlUrl
    );

    mergedApi.grantMutation(webSocketApi.api.outgoingMessageHandler);

    // Prints out URL
    new cdk.CfnOutput(this, "GraphqlAPIURL", {
      value: mergedApi.graphqlUrl,
    });

    // Prints out the AppSync GraphQL API key to the terminal
    new cdk.CfnOutput(this, "Graphql-schema-apiId", {
      value: restApi.graphqlApi.apiId || "",
    });

    // Prints out the AppSync GraphQL API key to the terminal
    new cdk.CfnOutput(this, "Graphql-schema-ws-apiId", {
      value: webSocketApi.api.graphQLApi.apiId || "",
    });

    this.messagesTopic = webSocketApi.messagesTopic;
    this.sessionsTable = chatTables.sessionsTable;
    this.byUserIdIndex = chatTables.byUserIdIndex;
    this.filesBucket = chatBuckets.filesBucket;
    this.graphqlApi = mergedApi;
  }
}
