import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";

export class RagDynamoDBTables extends Construct {
  public readonly rssFeedTable: dynamodb.Table;
  public readonly workspacesTable: dynamodb.Table;
  public readonly documentsTable: dynamodb.Table;
  public readonly workspacesByObjectTypeIndexName: string =
    "by_object_type_idx";
  public readonly documentsByCompoundKeyIndexName: string =
    "by_compound_key_idx";
  public readonly rssFeedDocumentTypeStatusIndexName: string =
    "by_document_type_status_idx";
  public readonly rssFeedWorkspaceDocumentTypesIndexName: string =
    "by_workspace_document_type_idx";

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
      indexName: this.documentsByCompoundKeyIndexName,
      partitionKey: {
        name: "workspace_id",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "compound_sort_key",
        type: dynamodb.AttributeType.STRING,
      },
    });

    const rssFeedTable = new dynamodb.Table(this, "RssFeedTable", {
      partitionKey: {
        name: "workspace_id",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "compound_sort_key",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    rssFeedTable.addLocalSecondaryIndex({
      indexName: this.rssFeedWorkspaceDocumentTypesIndexName,
      sortKey: {
        name: "document_type",
        type: dynamodb.AttributeType.STRING,
      },
    });

    rssFeedTable.addGlobalSecondaryIndex({
      indexName: this.rssFeedDocumentTypeStatusIndexName,
      partitionKey: {
        name: "document_type",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "status",
        type: dynamodb.AttributeType.STRING,
      },
    });

    this.workspacesTable = workspacesTable;
    this.documentsTable = documentsTable;
    this.rssFeedTable = rssFeedTable;
  }
}
