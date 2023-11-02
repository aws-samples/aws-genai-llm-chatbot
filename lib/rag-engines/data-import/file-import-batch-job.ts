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

    const computeEnvironment = new batch.ManagedEc2EcsComputeEnvironment(
      this,
      "ManagedEc2EcsComputeEnvironment",
      {
        vpc: props.shared.vpc,
        allocationStrategy: batch.AllocationStrategy.BEST_FIT,
        maxvCpus: 4,
        minvCpus: 0,
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

    const fileImportContainer = new batch.EcsEc2ContainerDefinition(
      this,
      "FileImportContainer",
      {
        cpu: 1,
        memory: cdk.Size.mebibytes(1024),
        image: ecs.ContainerImage.fromAsset("lib/shared", {
          platform: aws_ecr_assets.Platform.LINUX_AMD64,
          file: "file-import-dockerfile",
        }),
        jobRole: fileImportJobRole,
        environment: {
          AWS_DEFAULT_REGION: cdk.Stack.of(this).region,
          CONFIG_PARAMETER_NAME: props.shared.configParameter.parameterName,
          API_KEYS_SECRETS_ARN: props.shared.apiKeysSecret.secretArn,
          AURORA_DB_SECRET_ID: props.auroraDatabase?.secret
            ?.secretArn as string,
          PROCESSING_BUCKET_NAME: props.processingBucket.bucketName,
          WORKSPACES_TABLE_NAME:
            props.ragDynamoDBTables.workspacesTable.tableName,
          WORKSPACES_BY_OBJECT_TYPE_INDEX_NAME:
            props.ragDynamoDBTables.workspacesByObjectTypeIndexName,
          DOCUMENTS_TABLE_NAME:
            props.ragDynamoDBTables.documentsTable.tableName ?? "",
          DOCUMENTS_BY_COMPOUND_KEY_INDEX_NAME:
            props.ragDynamoDBTables.documentsByCompountKeyIndexName ?? "",
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
      props.auroraDatabase.secret?.grantRead(fileImportJobRole);
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
          resources: ["*"],
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
  }
}
