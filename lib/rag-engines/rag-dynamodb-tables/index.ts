import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";

export class RagDynamoDBTables extends Construct {
  public readonly workspacesTable: dynamodb.Table;
  public readonly documentsTable: dynamodb.Table;
  public readonly workspacesByObjectTypeIndexName: string =
    "by_object_type_idx";
  public readonly documentsByCompountKeyIndexName: string =
    "by_compound_key_idx";

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const workspacesTable = new dynamodb.Table(this, "Workspaces", {
      partitionKey: {
        name: "workspace_id",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "object_type",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    workspacesTable.addGlobalSecondaryIndex({
      indexName: this.workspacesByObjectTypeIndexName,
      partitionKey: {
        name: "object_type",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "created_at",
        type: dynamodb.AttributeType.STRING,
      },
    });

    const documentsTable = new dynamodb.Table(this, "Documents", {
      partitionKey: {
        name: "workspace_id",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "document_id",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    documentsTable.addGlobalSecondaryIndex({
      indexName: this.documentsByCompountKeyIndexName,
      partitionKey: {
        name: "workspace_id",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "compound_sort_key",
        type: dynamodb.AttributeType.STRING,
      },
    });

    this.workspacesTable = workspacesTable;
    this.documentsTable = documentsTable;
  }
}
