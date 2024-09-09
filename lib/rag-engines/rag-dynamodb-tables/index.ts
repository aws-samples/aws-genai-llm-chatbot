import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as kms from "aws-cdk-lib/aws-kms";
import { Construct } from "constructs";

export interface RagDynamoDBTablesProps {
  readonly retainOnDelete?: boolean;
  readonly kmsKey?: kms.Key;
}

export class RagDynamoDBTables extends Construct {
  public readonly workspacesTable: dynamodb.Table;
  public readonly documentsTable: dynamodb.Table;
  public readonly workspacesByObjectTypeIndexName: string =
    "by_object_type_idx";
  public readonly documentsByCompoundKeyIndexName: string =
    "by_compound_key_idx";
  public readonly documentsByStatusIndexName: string = "by_status_idx";

  constructor(scope: Construct, id: string, props: RagDynamoDBTablesProps) {
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
      encryption: props.kmsKey
        ? dynamodb.TableEncryption.CUSTOMER_MANAGED
        : dynamodb.TableEncryption.AWS_MANAGED,
      encryptionKey: props.kmsKey,
      pointInTimeRecovery: true,
      removalPolicy:
        props.retainOnDelete === true
          ? cdk.RemovalPolicy.RETAIN_ON_UPDATE_OR_DELETE
          : cdk.RemovalPolicy.DESTROY,
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
      encryption: props.kmsKey
        ? dynamodb.TableEncryption.CUSTOMER_MANAGED
        : dynamodb.TableEncryption.AWS_MANAGED,
      encryptionKey: props.kmsKey,
      pointInTimeRecovery: true,
      removalPolicy:
        props.retainOnDelete === true
          ? cdk.RemovalPolicy.RETAIN_ON_UPDATE_OR_DELETE
          : cdk.RemovalPolicy.DESTROY,
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

    documentsTable.addGlobalSecondaryIndex({
      indexName: this.documentsByStatusIndexName,
      partitionKey: {
        name: "status",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "document_type",
        type: dynamodb.AttributeType.STRING,
      },
    });

    this.workspacesTable = workspacesTable;
    this.documentsTable = documentsTable;
  }
}
