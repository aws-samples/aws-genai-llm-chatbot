import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { removeAssetHashes } from "../utils/template-util";
import { Monitoring } from "../../lib/monitoring";
import { GraphqlApi } from "aws-cdk-lib/aws-appsync";
import { Table } from "aws-cdk-lib/aws-dynamodb";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { DatabaseCluster } from "aws-cdk-lib/aws-rds";
import { CfnCollection } from "aws-cdk-lib/aws-opensearchserverless";
import { CfnIndex } from "aws-cdk-lib/aws-kendra";
import { Bucket } from "aws-cdk-lib/aws-s3";
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
  deadLetterQueue: {
    queue: new Queue(stack, "DLQ"),
    maxReceiveCount: 1,
  },
});

new Monitoring(stack, "Monitoring", {
  prefix: "",
  appsycnApi: GraphqlApi.fromGraphqlApiAttributes(stack, "GraphQL", {
    graphqlApiId: "graphqlApiId",
  }),
  appsyncResolversLogGroups: [LogGroup.fromLogGroupName(stack, "Test", "Test")],
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
  buckets: [new Bucket(stack, "Bucket", {})],
  ragFunctionProcessing: [Function.fromFunctionName(stack, "Function", "Name")],
  ragStateMachineProcessing: [
    StateMachine.fromStateMachineName(stack, "StateMachine", "Name"),
  ],
});

test("snapshot test", () => {
  const templateJson = Template.fromStack(stack).toJSON();
  removeAssetHashes(templateJson);
  expect(templateJson).toMatchSnapshot();
});
