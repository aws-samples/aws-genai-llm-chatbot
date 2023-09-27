import * as cdk from "aws-cdk-lib";
import * as path from "path";
import { Construct } from "constructs";
import { SystemConfig } from "../../../shared/types";
import { Shared } from "../../../shared";
import * as batch from "aws-cdk-lib/aws-batch";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as aws_ecr_assets from "aws-cdk-lib/aws-ecr-assets";
import * as iam from "aws-cdk-lib/aws-iam";

export interface BatchJobsProps {
  readonly config: SystemConfig;
  readonly shared: Shared;
  readonly uploadBucket: s3.Bucket;
  readonly processingBucket: s3.Bucket;
}

export class BatchJobs extends Construct {
  public readonly fargateEnvironment: batch.FargateComputeEnvironment;
  public readonly jobQueue: batch.JobQueue;
  public readonly fileConverterJob: batch.EcsJobDefinition;

  constructor(scope: Construct, id: string, props: BatchJobsProps) {
    super(scope, id);

    const fargateEnvironment = new batch.FargateComputeEnvironment(
      this,
      "FargateComputeEnvironment",
      {
        vpc: props.shared.vpc,
        maxvCpus: 2,
        spot: true,
        replaceComputeEnvironment: true,
        updateTimeout: cdk.Duration.minutes(30),
        updateToLatestImageVersion: true,
      }
    );

    const jobQueue = new batch.JobQueue(this, "JobQueue", {
      computeEnvironments: [
        {
          computeEnvironment: fargateEnvironment,
          order: 1,
        },
      ],
      priority: 1,
    });

    const fileConverterJobRole = new iam.Role(this, "FileConverterJobRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AmazonECSTaskExecutionRolePolicy"
        ),
      ],
    });

    props.uploadBucket.grantReadWrite(fileConverterJobRole);
    props.processingBucket.grantReadWrite(fileConverterJobRole);

    const fileConverterContainer = new batch.EcsFargateContainerDefinition(
      this,
      "FileConverterContainer",
      {
        cpu: 1,
        memory: cdk.Size.mebibytes(2048),
        image: ecs.ContainerImage.fromAsset(
          path.join(__dirname, "./file-converter"),
          {
            platform: aws_ecr_assets.Platform.LINUX_AMD64,
          }
        ),
        jobRole: fileConverterJobRole,
      }
    );

    const fileConverterJob = new batch.EcsJobDefinition(
      this,
      "FileConverterJob",
      {
        container: fileConverterContainer,
        timeout: cdk.Duration.minutes(30),
      }
    );

    this.fargateEnvironment = fargateEnvironment;
    this.jobQueue = jobQueue;
    this.fileConverterJob = fileConverterJob;
  }
}
