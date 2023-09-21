import { Construct } from "constructs";
import { Shared } from "../shared";
import { SageMakerLLMEndpoint, SystemConfig } from "../shared/types";
import { RestApi } from "./rest-api";
import { WebSocketApi } from "./websocket-api";
import { ChatBotDynamoDBTables } from "./chatbot-dynamodb-tables";
import { RagEngines } from "../rag-engines";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as apigwv2 from "@aws-cdk/aws-apigatewayv2-alpha";
import * as sns from "aws-cdk-lib/aws-sns";
import * as ssm from "aws-cdk-lib/aws-ssm";

export interface ChatBotApiProps {
  readonly shared: Shared;
  readonly config: SystemConfig;
  readonly ragEngines?: RagEngines;
  readonly userPool: cognito.UserPool;
  readonly llmsParameter: ssm.StringParameter;
  readonly llms: SageMakerLLMEndpoint[];
}

export class ChatBotApi extends Construct {
  public readonly restApi: apigateway.RestApi;
  public readonly webSocketApi: apigwv2.WebSocketApi;
  public readonly messagesTopic: sns.Topic;
  public readonly sessionsTable: dynamodb.Table;
  public readonly byUserIdIndex: string;

  constructor(scope: Construct, id: string, props: ChatBotApiProps) {
    super(scope, id);

    const chatTables = new ChatBotDynamoDBTables(this, "ChatDynamoDBTables");

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
  }
}
