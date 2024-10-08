import * as path from "path";
import * as cdk from "aws-cdk-lib";
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as sagemaker from "aws-cdk-lib/aws-sagemaker";
import * as cr from "aws-cdk-lib/custom-resources";
import * as kms from "aws-cdk-lib/aws-kms";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";
import { NagSuppressions } from "cdk-nag";

import { ContainerImages } from "../container-images";
import { ImageRepositoryMapping } from "../image-repository-mapping";

export interface HuggingFaceCustomScriptModelProps {
  vpc: ec2.Vpc;
  region: string;
  instanceType: string;
  modelId: string | string[];
  container?: string;
  codeFolder?: string;
  codeBuildComputeType?: codebuild.ComputeType;
  env?: { [key: string]: string };
  architecture?: lambda.Architecture;
  runtime?: lambda.Runtime;
  kmsKey?: kms.Key;
  retainOnDelete?: boolean;
  logRetention?: number;
  enableEndpointKMSEncryption: boolean;
}

export class HuggingFaceCustomScriptModel extends Construct {
  public readonly model: sagemaker.CfnModel;
  public readonly endpoint: sagemaker.CfnEndpoint;

  constructor(
    scope: Construct,
    id: string,
    props: HuggingFaceCustomScriptModelProps
  ) {
    super(scope, id);

    const {
      region,
      instanceType,
      container,
      codeFolder,
      codeBuildComputeType,
      env,
    } = props;
    const modelId = Array.isArray(props.modelId)
      ? props.modelId.join(",")
      : props.modelId;

    const logsBucket = new s3.Bucket(this, "LogsBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy:
        props.retainOnDelete === true
          ? cdk.RemovalPolicy.RETAIN_ON_UPDATE_OR_DELETE
          : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: props.retainOnDelete !== true,
      enforceSSL: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
    });

    const buildBucket = new s3.Bucket(this, "Bucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy:
        props.retainOnDelete === true
          ? cdk.RemovalPolicy.RETAIN_ON_UPDATE_OR_DELETE
          : cdk.RemovalPolicy.DESTROY,
      enforceSSL: true,
      serverAccessLogsBucket: logsBucket,
      autoDeleteObjects: props.retainOnDelete !== true,
      encryption: props.kmsKey
        ? s3.BucketEncryption.KMS
        : s3.BucketEncryption.S3_MANAGED,
      encryptionKey: props.kmsKey,
      versioned: true,
    });

    // Upload build code to S3
    new s3deploy.BucketDeployment(this, "Script", {
      sources: [s3deploy.Source.asset(path.join(__dirname, "./build-script"))],
      retainOnDelete: false,
      destinationBucket: buildBucket,
      destinationKeyPrefix: "build-script",
    });

    let deployment;
    // Upload model folder to S3
    if (codeFolder) {
      deployment = new s3deploy.BucketDeployment(this, "ModelCode", {
        sources: [s3deploy.Source.asset(codeFolder)],
        retainOnDelete: false,
        destinationBucket: buildBucket,
        destinationKeyPrefix: "model-code",
      });
    }

    // CodeBuild role
    const codeBuildRole = new iam.Role(this, "CodeBuildRole", {
      assumedBy: new iam.ServicePrincipal("codebuild.amazonaws.com"),
      inlinePolicies: {
        CodeBuildPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents",
              ],
              resources: ["*"],
            }),
          ],
        }),
      },
    });

    const buildspec = codebuild.BuildSpec.fromObject({
      version: "0.2",
      phases: {
        install: {
          commands: [
            'echo "Updating system packages..."',
            "apt-get update",
            'echo "Installing tar, pigz, awscli, virtualenv, python3-pip, and python3-dev..."',
            "apt-get install -y tar pigz awscli virtualenv python3-pip python3-dev",
            'echo "Updating pip..."',
            "pip3 install --upgrade pip",
          ],
        },
        pre_build: {
          commands: [
            'echo "Downloading build code from S3..."',
            "aws s3 cp s3://$BUILD_BUCKET/build-script ./build --recursive",
            'echo "Downloading model from S3..."',
            "aws s3 cp s3://$BUILD_BUCKET/model-code ./model --recursive",
            "ls -al",
            "ls -al ./build",
            "ls -al ./model",
            "COMMIT_HASH=$(echo $CODEBUILD_RESOLVED_SOURCE_VERSION | cut -c 1-7)",
            "IMAGE_TAG=${COMMIT_HASH:=latest}",
          ],
        },
        build: {
          commands: [
            'echo "Installing Python requirements..."',
            "pip3 install -r build/requirements.txt --upgrade",
            'echo "Running script.py..."',
            "python3 build/script.py",
          ],
        },
      },
    });

    // CodeBuild project
    const codeBuildProject = new codebuild.Project(this, "CodeBuildProject", {
      buildSpec: buildspec,
      role: codeBuildRole,
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        privileged: true,
        computeType: codeBuildComputeType ?? codebuild.ComputeType.LARGE,
      },
      environmentVariables: {
        MODEL_ID: {
          value: modelId,
        },
        BUILD_BUCKET: {
          value: buildBucket.bucketName,
        },
        HF_HUB_ENABLE_HF_TRANSFER: {
          value: "1",
        },
        HF_HUB_DISABLE_PROGRESS_BARS: {
          value: "1",
        },
        HF_HUB_DISABLE_TELEMETRY: {
          value: "1",
        },
      },
    });

    if (codeFolder && deployment) {
      codeBuildProject.node.addDependency(deployment);
    }

    buildBucket.grantReadWrite(codeBuildProject.grantPrincipal);

    // custom resource lamdba handlers
    const onEventHandler = new lambda.Function(this, "OnEventHandler", {
      description: "Manages HuggingFace model build requests",
      runtime: lambda.Runtime.PYTHON_3_11,
      architecture: lambda.Architecture.ARM_64,
      loggingFormat: lambda.LoggingFormat.JSON,
      logRetention: props.logRetention ?? logs.RetentionDays.ONE_WEEK,
      code: lambda.Code.fromAsset(path.join(__dirname, "./build-function")),
      handler: "index.on_event",
    });

    // grant the lambda role permissions to start the build
    onEventHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["codebuild:StartBuild"],
        resources: [codeBuildProject.projectArn],
      })
    );

    // custom resource lamdba handlers
    const isCompleteHandler = new lambda.Function(this, "IsCompleteHandler", {
      description: "Checks the completion of an HuggingFace build request",
      runtime: lambda.Runtime.PYTHON_3_11,
      architecture: lambda.Architecture.ARM_64,
      loggingFormat: lambda.LoggingFormat.JSON,
      logRetention: props.logRetention ?? logs.RetentionDays.ONE_WEEK,
      code: lambda.Code.fromAsset(path.join(__dirname, "./build-function")),
      handler: "index.is_complete",
    });

    // grant the lambda role permissions to BatchGetBuilds
    isCompleteHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["codebuild:BatchGetBuilds"],
        resources: [codeBuildProject.projectArn],
      })
    );

    // create a custom resource to start build and wait for it to complete
    const provider = new cr.Provider(this, "Provider", {
      onEventHandler: onEventHandler,
      isCompleteHandler: isCompleteHandler,
      queryInterval: cdk.Duration.seconds(30),
      totalTimeout: cdk.Duration.minutes(120),
    });
    provider.node.addDependency(codeBuildProject);

    // run the custom resource to start the build
    const build = new cdk.CustomResource(this, "Build", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      serviceToken: provider.serviceToken,
      properties: {
        ProjectName: codeBuildProject.projectName,
      },
    });

    const executionRole = new iam.Role(this, "SageMakerExecutionRole", {
      assumedBy: new iam.ServicePrincipal("sagemaker.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSageMakerFullAccess"),
      ],
    });

    buildBucket.grantRead(executionRole);

    const containerImage =
      container || ContainerImages.HF_PYTORCH_INFERENCE_LATEST;
    const imageMapping = new ImageRepositoryMapping(
      scope,
      "CustomScriptModelMapping",
      { region }
    );
    const image = `${imageMapping.account}.dkr.ecr.${region}.amazonaws.com/${containerImage}`;

    const model = new sagemaker.CfnModel(this, "Model", {
      executionRoleArn: executionRole.roleArn,
      primaryContainer: {
        image,
        modelDataUrl: `s3://${buildBucket.bucketName}/out/model.tar.gz`,
        mode: "SingleModel",
        environment: {
          SAGEMAKER_CONTAINER_LOG_LEVEL: "20",
          SAGEMAKER_REGION: region,
          ...env,
        },
      },
      /*       vpcConfig: {
        subnets: vpc.selectSubnets({
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        }).subnetIds,
        securityGroupIds: [vpc.vpcDefaultSecurityGroup],
      }, */
    });

    model.node.addDependency(build);

    const endpointConfig = new sagemaker.CfnEndpointConfig(
      this,
      "EndpointConfig",
      {
        kmsKeyId:
          props.kmsKey && props.enableEndpointKMSEncryption
            ? props.kmsKey.keyId
            : undefined,
        productionVariants: [
          {
            instanceType,
            initialVariantWeight: 1,
            initialInstanceCount: 1,
            variantName: "AllTraffic",
            modelName: model.getAtt("ModelName").toString(),
            containerStartupHealthCheckTimeoutInSeconds: 900,
          },
        ],
      }
    );

    endpointConfig.addDependency(model);

    const endpoint = new sagemaker.CfnEndpoint(this, "Endpoint", {
      endpointConfigName: endpointConfig
        .getAtt("EndpointConfigName")
        .toString(),
    });

    endpoint.addDependency(endpointConfig);

    this.model = model;
    this.endpoint = endpoint;

    /**
     * CDK NAG suppression
     */
    NagSuppressions.addResourceSuppressions(codeBuildRole, [
      {
        id: "AwsSolutions-IAM5",
        reason:
          "Access to all log groups required for CloudWatch log group creation.",
      },
    ]);
    NagSuppressions.addResourceSuppressions(codeBuildProject, [
      {
        id: "AwsSolutions-CB4",
        reason:
          "Build is only ran as part of stack creation and does not contain external data.",
      },
      {
        id: "AwsSolutions-CB3",
        reason:
          "Privileged mode is required as build project is used to build Docker images.",
      },
    ]);
    NagSuppressions.addResourceSuppressions(executionRole, [
      {
        id: "AwsSolutions-IAM4",
        reason:
          "Gives user ability to deploy and delete endpoints from the UI.",
      },
      {
        id: "AwsSolutions-IAM5",
        reason:
          "Gives user ability to deploy and delete endpoints from the UI.",
      },
    ]);
    NagSuppressions.addResourceSuppressions(logsBucket, [
      {
        id: "AwsSolutions-S1",
        reason: "Logging bucket does not require it's own access logs.",
      },
    ]);
  }
}
