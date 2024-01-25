import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";

export class ChatBotDynamoDBTables extends Construct {
  public readonly sessionsTable: dynamodb.Table;
  public readonly byUserIdIndex: string = "byUserId";

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const sessionsTable = new dynamodb.Table(this, "SessionsTable", {
      partitionKey: {
        name: "SessionId",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "UserId",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: true,
    });

    sessionsTable.addGlobalSecondaryIndex({
      indexName: this.byUserIdIndex,
      partitionKey: { name: "UserId", type: dynamodb.AttributeType.STRING },
    });

    this.sessionsTable = sessionsTable;
  }
}
