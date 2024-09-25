import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { removeAssetHashes } from "../utils/template-util";
import { Monitoring } from "../../lib/monitoring";
import { GraphqlApi } from "aws-cdk-lib/aws-appsync";
import { Table } from "aws-cdk-lib/aws-dynamodb";
import { Queue, QueueEncryption } from "aws-cdk-lib/aws-sqs";
import { DatabaseCluster } from "aws-cdk-lib/aws-rds";
import { CfnCollection } from "aws-cdk-lib/aws-opensearchserverless";
import { CfnIndex } from "aws-cdk-lib/aws-kendra";
import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
} from "aws-cdk-lib/aws-s3";
import { Function } from "aws-cdk-lib/aws-lambda";
import { StateMachine } from "aws-cdk-lib/aws-stepfunctions";
import { LogGroup } from "aws-cdk-lib/aws-logs";

jest.spyOn(console, "log").mockImplementation(() => {});

const app = new App({
  context: {
    "aws:cdk:bundling-stacks": [],
  },
});
const stack = new Stack(app);

new Queue(stack, "Queue", {
  encryption: QueueEncryption.KMS_MANAGED,
  deadLetterQueue: {
    queue: new Queue(stack, "DLQ", { encryption: QueueEncryption.KMS_MANAGED }),
    maxReceiveCount: 1,
  },
});

new Monitoring(stack, "Monitoring", {
  prefix: "",
  advancedMonitoring: true,
  appsycnApi: GraphqlApi.fromGraphqlApiAttributes(stack, "GraphQL", {
    graphqlApiId: "graphqlApiId",
  }),
  appsyncResolversLogGroups: [LogGroup.fromLogGroupName(stack, "Test", "Test")],
  llmRequestHandlersLogGroups: [
    LogGroup.fromLogGroupName(stack, "Test2", "Test2"),
  ],
  cognito: { userPoolId: "userPoolId", clientId: "clientId" },
  tables: [Table.fromTableName(stack, "Table", "Name")],
  sqs: [],
  aurora: DatabaseCluster.fromDatabaseClusterAttributes(stack, "Cluster", {
    clusterIdentifier: "clusterIdentifier",
  }),
  opensearch: new CfnCollection(stack, "Collection", { name: "name" }),
  kendra: new CfnIndex(stack, "Index", {
    roleArn: "roleArn",
    edition: "edition",
    name: "name",
  }),
  buckets: [
    new Bucket(stack, "Bucket", {
      publicReadAccess: false,
      versioned: true,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
    }),
  ],
  ragFunctionProcessing: [Function.fromFunctionName(stack, "Function", "Name")],
  ragEngineStateMachineProcessing: [
    StateMachine.fromStateMachineName(stack, "StateMachine1", "Name1"),
  ],
  ragImportStateMachineProcessing: [
    StateMachine.fromStateMachineName(stack, "StateMachine2", "Name2"),
  ],
});

test("snapshot test", () => {
  const templateJson = Template.fromStack(stack).toJSON();
  removeAssetHashes(templateJson);
  expect(templateJson).toMatchSnapshot();
});
