import * as apigwv2 from "@aws-cdk/aws-apigatewayv2-alpha";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as sns from "aws-cdk-lib/aws-sns";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";
import { RagEngines } from "../rag-engines";
import { Shared } from "../shared";
import { SageMakerModelEndpoint, SystemConfig } from "../shared/types";
import { ChatBotDynamoDBTables } from "./chatbot-dynamodb-tables";
import { ChatBotS3Buckets } from "./chatbot-s3-buckets";
import { RestApi } from "./rest-api";
import { WebSocketApi } from "./websocket-api";

export interface ChatBotApiProps {
  readonly shared: Shared;
  readonly config: SystemConfig;
  readonly ragEngines?: RagEngines;
  readonly userPool: cognito.UserPool;
  readonly modelsParameter: ssm.StringParameter;
  readonly models: SageMakerModelEndpoint[];
}

export class ChatBotApi extends Construct {
  public readonly restApi: apigateway.RestApi;
  public readonly webSocketApi: apigwv2.WebSocketApi;
  public readonly messagesTopic: sns.Topic;
  public readonly sessionsTable: dynamodb.Table;
  public readonly byUserIdIndex: string;
  public readonly filesBucket: s3.Bucket;

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

    this.restApi = restApi.api;
    this.webSocketApi = webSocketApi.api;
    this.messagesTopic = webSocketApi.messagesTopic;
    this.sessionsTable = chatTables.sessionsTable;
    this.byUserIdIndex = chatTables.byUserIdIndex;
    this.filesBucket = chatBuckets.filesBucket;
  }
}
