import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { Shared } from "../../shared";
import { SystemConfig } from "../../shared/types";
import { RagDynamoDBTables } from "../rag-dynamodb-tables";
import { CreateKendraWorkspace } from "./create-kendra-workspace";
import { Utils } from "../../shared/utils";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from "aws-cdk-lib/aws-iam";
import * as kendra from "aws-cdk-lib/aws-kendra";

export interface KendraRetrievalProps {
  readonly config: SystemConfig;
  readonly shared: Shared;
  readonly ragDynamoDBTables: RagDynamoDBTables;
}

export class KendraRetrieval extends Construct {
  public readonly createKendraWorkspaceWorkflow: sfn.StateMachine;
  public readonly kendraIndex?: kendra.CfnIndex;
  public readonly kendraS3DataSource?: kendra.CfnDataSource;
  public readonly kendraS3DataSourceBucket?: s3.Bucket;

  constructor(scope: Construct, id: string, props: KendraRetrievalProps) {
    super(scope, id);

    const createWorkflow = new CreateKendraWorkspace(
      this,
      "CreateKendraWorkspace",
      {
        config: props.config,
        shared: props.shared,
        ragDynamoDBTables: props.ragDynamoDBTables,
      }
    );

    if (props.config.rag.engines.kendra.createIndex) {
      const indexName = Utils.getName(
        props.config,
        (props.shared.kmsKey ? "cmk-" : "") + "genaichatbot-workspaces"
      );

      const logsBucket = new s3.Bucket(this, "LogsBucket", {
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        removalPolicy:
          props.config.retainOnDelete === true
            ? cdk.RemovalPolicy.RETAIN_ON_UPDATE_OR_DELETE
            : cdk.RemovalPolicy.DESTROY,
        autoDeleteObjects: props.config.retainOnDelete !== true,
        enforceSSL: true,
        versioned: true,
        encryption: s3.BucketEncryption.S3_MANAGED,
      });

      const dataBucket = new s3.Bucket(this, "KendraDataBucket", {
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        removalPolicy:
          props.config.retainOnDelete === true
            ? cdk.RemovalPolicy.RETAIN_ON_UPDATE_OR_DELETE
            : cdk.RemovalPolicy.DESTROY,
        autoDeleteObjects: props.config.retainOnDelete !== true,
        enforceSSL: true,
        serverAccessLogsBucket: logsBucket,
        versioned: true,
        encryption: props.shared.kmsKey
          ? s3.BucketEncryption.KMS
          : s3.BucketEncryption.S3_MANAGED,
        encryptionKey: props.shared.kmsKey,
      });

      const kendraRole = new iam.Role(this, "KendraRole", {
        assumedBy: new iam.ServicePrincipal("kendra.amazonaws.com"),
      });

      kendraRole.addToPolicy(
        new iam.PolicyStatement({
          actions: ["logs:*", "cloudwatch:*"],
          resources: ["*"],
        })
      );

      dataBucket.grantRead(kendraRole);

      const kendraIndex = new kendra.CfnIndex(this, "Index", {
        edition: props.config.rag?.engines.kendra?.enterprise
          ? "ENTERPRISE_EDITION"
          : "DEVELOPER_EDITION",
        name: indexName,
        roleArn: kendraRole.roleArn,
        serverSideEncryptionConfiguration: props.shared.kmsKey
          ? {
              kmsKeyId: props.shared.kmsKey.keyId,
            }
          : undefined,
        documentMetadataConfigurations: [
          {
            name: "workspace_id",
            type: "STRING_VALUE",
            search: {
              displayable: true,
              facetable: true,
              searchable: true,
            },
          },
          {
            name: "document_type",
            type: "STRING_VALUE",
            search: {
              displayable: true,
              facetable: true,
              searchable: true,
            },
          },
        ],
      });

      const s3DataSource = new kendra.CfnDataSource(
        this,
        // Force re-creation if the key is provided
        // because the Kendra index would be re-created.
        "KendraS3DataSource" + (props.shared.kmsKey ? "-CMK" : ""),
        {
          type: "S3",
          name: "KendraS3DataSource",
          indexId: kendraIndex.ref,
          description: "S3 Data Source for Kendra Index",
          dataSourceConfiguration: {
            s3Configuration: {
              bucketName: dataBucket.bucketName,
              inclusionPrefixes: ["documents"],
              documentsMetadataConfiguration: {
                s3Prefix: "metadata",
              },
            },
          },
          roleArn: kendraRole.roleArn,
        }
      );

      kendraRole.addToPolicy(
        new iam.PolicyStatement({
          actions: ["kendra:BatchDeleteDocument"],
          resources: [kendraIndex.attrArn, s3DataSource.attrArn],
        })
      );

      this.kendraIndex = kendraIndex;
      this.kendraS3DataSource = s3DataSource;
      this.kendraS3DataSourceBucket = dataBucket;
    }

    this.createKendraWorkspaceWorkflow = createWorkflow.stateMachine;
  }
}
