import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { SystemConfig } from "../../shared/types";
import { Shared } from "../../shared";
import { RagDynamoDBTables } from "../rag-dynamodb-tables";
import { OpenSearchVector } from "../opensearch-vector";
import * as batch from "aws-cdk-lib/aws-batch";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as aws_ecr_assets from "aws-cdk-lib/aws-ecr-assets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as rds from "aws-cdk-lib/aws-rds";
import * as sagemaker from "aws-cdk-lib/aws-sagemaker";
import { NagSuppressions } from "cdk-nag";
import { AURORA_DB_USERS } from "../aurora-pgvector";

export interface FileImportBatchJobProps {
  readonly config: SystemConfig;
  readonly shared: Shared;
  readonly uploadBucket: s3.Bucket;
  readonly processingBucket: s3.Bucket;
  readonly ragDynamoDBTables: RagDynamoDBTables;
  readonly auroraDatabase?: rds.DatabaseCluster;
  readonly sageMakerRagModelsEndpoint?: sagemaker.CfnEndpoint;
  readonly openSearchVector?: OpenSearchVector;
}

export class FileImportBatchJob extends Construct {
  public readonly jobQueue: batch.JobQueue;
  public readonly fileImportJob: batch.EcsJobDefinition;

  constructor(scope: Construct, id: string, props: FileImportBatchJobProps) {
    super(scope, id);

    const computeEnvironment = new batch.FargateComputeEnvironment(
      this,
      "FargateComputeEnvironment",
      {
        vpc: props.shared.vpc,
        replaceComputeEnvironment: true,
        updateTimeout: cdk.Duration.minutes(30),
        updateToLatestImageVersion: true,
      }
    );

    const jobQueue = new batch.JobQueue(this, "JobQueue", {
      computeEnvironments: [
        {
          computeEnvironment,
          order: 1,
        },
      ],
      priority: 1,
    });

    const fileImportJobRole = new iam.Role(this, "FileImportJobRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AmazonECSTaskExecutionRolePolicy"
        ),
      ],
    });

    const fileImportContainer = new batch.EcsFargateContainerDefinition(
      this,
      "FileImportContainer",
      {
        // Possible values
        // https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html
        cpu: 2,
        memory: cdk.Size.mebibytes(4096),
        ephemeralStorageSize: cdk.Size.gibibytes(40),
        image: ecs.ContainerImage.fromAsset("lib/shared", {
          platform: aws_ecr_assets.Platform.LINUX_AMD64,
          file: "file-import-dockerfile",
        }),
        jobRole: fileImportJobRole,
        environment: {
          AWS_DEFAULT_REGION: cdk.Stack.of(this).region,
          CONFIG_PARAMETER_NAME: props.shared.configParameter.parameterName,
          API_KEYS_SECRETS_ARN: props.shared.apiKeysSecret.secretArn,
          AURORA_DB_USER: AURORA_DB_USERS.WRITE,
          AURORA_DB_HOST: props.auroraDatabase?.clusterEndpoint?.hostname ?? "",
          AURORA_DB_PORT: props.auroraDatabase?.clusterEndpoint?.port + "",
          PROCESSING_BUCKET_NAME: props.processingBucket.bucketName,
          WORKSPACES_TABLE_NAME:
            props.ragDynamoDBTables.workspacesTable.tableName,
          WORKSPACES_BY_OBJECT_TYPE_INDEX_NAME:
            props.ragDynamoDBTables.workspacesByObjectTypeIndexName,
          DOCUMENTS_TABLE_NAME:
            props.ragDynamoDBTables.documentsTable.tableName ?? "",
          DOCUMENTS_BY_COMPOUND_KEY_INDEX_NAME:
            props.ragDynamoDBTables.documentsByCompoundKeyIndexName ?? "",
          SAGEMAKER_RAG_MODELS_ENDPOINT:
            props.sageMakerRagModelsEndpoint?.attrEndpointName ?? "",
          OPEN_SEARCH_COLLECTION_ENDPOINT:
            props.openSearchVector?.openSearchCollectionEndpoint ?? "",
        },
      }
    );

    const fileImportJob = new batch.EcsJobDefinition(this, "FileImportJob", {
      container: fileImportContainer,
      timeout: cdk.Duration.minutes(30),
      retryAttempts: 3,
      retryStrategies: [
        batch.RetryStrategy.of(
          batch.Action.EXIT,
          batch.Reason.CANNOT_PULL_CONTAINER
        ),
        batch.RetryStrategy.of(
          batch.Action.EXIT,
          batch.Reason.custom({
            onExitCode: "137",
          })
        ),
      ],
    });

    props.uploadBucket.grantReadWrite(fileImportJobRole);
    props.processingBucket.grantReadWrite(fileImportJobRole);
    props.shared.configParameter.grantRead(fileImportJobRole);
    props.shared.apiKeysSecret.grantRead(fileImportJobRole);
    props.ragDynamoDBTables.workspacesTable.grantReadWriteData(
      fileImportJobRole
    );
    props.ragDynamoDBTables.documentsTable.grantReadWriteData(
      fileImportJobRole
    );

    if (props.auroraDatabase) {
      props.auroraDatabase.grantConnect(
        fileImportJobRole,
        AURORA_DB_USERS.WRITE
      );
      props.auroraDatabase.connections.allowDefaultPortFrom(computeEnvironment);
    }

    if (props.openSearchVector) {
      fileImportJobRole.addToPolicy(
        new iam.PolicyStatement({
          actions: ["aoss:APIAccessAll"],
          resources: [props.openSearchVector.openSearchCollection.attrArn],
        })
      );

      props.openSearchVector.addToAccessPolicy(
        "file-import-job",
        [fileImportJobRole.roleArn],
        ["aoss:DescribeIndex", "aoss:ReadDocument", "aoss:WriteDocument"]
      );

      props.openSearchVector.createOpenSearchWorkspaceWorkflow.grantStartExecution(
        fileImportJobRole
      );
    }

    if (props.sageMakerRagModelsEndpoint) {
      fileImportJobRole.addToPolicy(
        new iam.PolicyStatement({
          actions: ["sagemaker:InvokeEndpoint"],
          resources: [props.sageMakerRagModelsEndpoint.ref],
        })
      );
    }

    if (props.config.bedrock?.enabled) {
      fileImportJobRole.addToPolicy(
        new iam.PolicyStatement({
          actions: [
            "bedrock:InvokeModel",
            "bedrock:InvokeModelWithResponseStream",
          ],
          resources: ["arn:aws:bedrock:*"],
        })
      );

      if (props.config.bedrock?.roleArn) {
        fileImportJobRole.addToPolicy(
          new iam.PolicyStatement({
            actions: ["sts:AssumeRole"],
            resources: [props.config.bedrock.roleArn],
          })
        );
      }
    }

    this.jobQueue = jobQueue;
    this.fileImportJob = fileImportJob;

    /**
     * CDK NAG suppression
     */
    NagSuppressions.addResourceSuppressions(fileImportJobRole, [
      {
        id: "AwsSolutions-IAM4",
        reason: "Allow user freedom of model usage in Bedrock.",
      },
      {
        id: "AwsSolutions-IAM5",
        reason:
          "Access to all log groups required for CloudWatch log group creation.",
      },
      {
        id: "AwsSolutions-IAM5",
        reason: "S3 write access required for upload and processing buckets.",
      },
    ]);
  }
}
