import * as path from "path";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { SystemConfig } from "../../shared/types";
import { Shared } from "../../shared";
import { CreateAuroraWorkspace } from "./create-aurora-workspace";
import { RagDynamoDBTables } from "../rag-dynamodb-tables";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as rds from "aws-cdk-lib/aws-rds";
import * as cr from "aws-cdk-lib/custom-resources";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import { NagSuppressions } from "cdk-nag";

export interface AuroraPgVectorProps {
  readonly config: SystemConfig;
  readonly shared: Shared;
  readonly ragDynamoDBTables: RagDynamoDBTables;
}

export class AuroraPgVector extends Construct {
  readonly database: rds.DatabaseCluster;
  public readonly createAuroraWorkspaceWorkflow: sfn.StateMachine;

  constructor(scope: Construct, id: string, props: AuroraPgVectorProps) {
    super(scope, id);

    const dbCluster = new rds.DatabaseCluster(this, "AuroraDatabase", {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_15_3,
      }),
      storageEncryptionKey: props.shared.kmsKey,
      // Always setting it to true would be a breaking change. (Undefined to prevent re-creating)
      storageEncrypted: props.shared.kmsKey ? true : undefined,
      removalPolicy:
        props.config.retainOnDelete === true
          ? cdk.RemovalPolicy.SNAPSHOT
          : cdk.RemovalPolicy.DESTROY,
      writer: rds.ClusterInstance.serverlessV2("ServerlessInstance"),
      vpc: props.shared.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      iamAuthentication: true,
    });

    const databaseSetupFunction = new lambda.Function(
      this,
      "DatabaseSetupFunction",
      {
        vpc: props.shared.vpc,
        code: props.shared.sharedCode.bundleWithLambdaAsset(
          path.join(__dirname, "./functions/pgvector-setup")
        ),
        description: "PGVector setup",
        runtime: props.shared.pythonRuntime,
        architecture: props.shared.lambdaArchitecture,
        handler: "index.lambda_handler",
        layers: [props.shared.powerToolsLayer, props.shared.commonLayer],
        timeout: cdk.Duration.minutes(5),
        logRetention: props.config.logRetention ?? logs.RetentionDays.ONE_WEEK,
        loggingFormat: lambda.LoggingFormat.JSON,
        environment: {
          ...props.shared.defaultEnvironmentVariables,
        },
      }
    );

    dbCluster.secret?.grantRead(databaseSetupFunction);
    dbCluster.connections.allowDefaultPortFrom(databaseSetupFunction);

    const databaseSetupProvider = new cr.Provider(
      this,
      "DatabaseSetupProvider",
      {
        vpc: props.shared.vpc,
        onEventHandler: databaseSetupFunction,
      }
    );

    const dbSetupResource = new cdk.CustomResource(
      this,
      // Force recreation on CMK change to re-init the DB cluster.
      "DatabaseSetupResource" + (props.shared.kmsKey ? "cmk-" : ""),
      {
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        serviceToken: databaseSetupProvider.serviceToken,
        properties: {
          AURORA_DB_SECRET_ID: dbCluster.secret?.secretArn as string,
        },
      }
    );

    dbSetupResource.node.addDependency(dbCluster);

    const createWorkflow = new CreateAuroraWorkspace(
      this,
      "CreateAuroraWorkspace",
      {
        config: props.config,
        shared: props.shared,
        dbCluster: dbCluster,
        ragDynamoDBTables: props.ragDynamoDBTables,
      }
    );

    this.database = dbCluster;
    this.createAuroraWorkspaceWorkflow = createWorkflow.stateMachine;

    /**
     * CDK NAG suppression
     */
    NagSuppressions.addResourceSuppressions(dbCluster, [
      {
        id: "AwsSolutions-RDS10",
        reason:
          "Deletion protection disabled to allow deletion as part of the CloudFormation stack.",
      },
      {
        id: "AwsSolutions-RDS2",
        reason:
          "Encryption cannot be enabled on an unencrypted DB Cluster, therefore enabling will destroy existing data. Docs provide instructions for users requiring it.",
      },
    ]);
  }
}
