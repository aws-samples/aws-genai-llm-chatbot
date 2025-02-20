import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as kms from "aws-cdk-lib/aws-kms";

export interface ApplicationDynamoDBTablesProps {
  readonly retainOnDelete?: boolean;
  readonly deletionProtection?: boolean;
  readonly kmsKey?: kms.Key;
}

export class ApplicationDynamoDBTables extends Construct {
  public readonly applicationTable: dynamodb.Table;

  constructor(
    scope: Construct,
    id: string,
    props: ApplicationDynamoDBTablesProps
  ) {
    super(scope, id);

    const applicationTable = new dynamodb.Table(this, "ApplicationsTable", {
      partitionKey: {
        name: "Id",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: props.kmsKey
        ? dynamodb.TableEncryption.CUSTOMER_MANAGED
        : dynamodb.TableEncryption.AWS_MANAGED,
      encryptionKey: props.kmsKey,
      removalPolicy:
        props.retainOnDelete === true
          ? cdk.RemovalPolicy.RETAIN_ON_UPDATE_OR_DELETE
          : cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: true,
      deletionProtection: props.deletionProtection,
    });

    this.applicationTable = applicationTable;
  }
}
