import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";
import * as path from "path";
import { Layer } from "../layer";
import { SystemConfig } from "./types";
import { SharedAssetBundler } from "./shared-asset-bundler";

const pythonRuntime = lambda.Runtime.PYTHON_3_11;
const lambdaArchitecture = lambda.Architecture.X86_64;
process.env.DOCKER_DEFAULT_PLATFORM = lambdaArchitecture.dockerPlatform;

export interface SharedProps {
  readonly config: SystemConfig;
}

export class Shared extends Construct {
  readonly vpc: ec2.Vpc;
  readonly defaultEnvironmentVariables: Record<string, string>;
  readonly configParameter: ssm.StringParameter;
  readonly pythonRuntime: lambda.Runtime = pythonRuntime;
  readonly lambdaArchitecture: lambda.Architecture = lambdaArchitecture;
  readonly xOriginVerifySecret: secretsmanager.Secret;
  readonly apiKeysSecret: secretsmanager.Secret;
  readonly commonLayer: lambda.ILayerVersion;
  readonly powerToolsLayer: lambda.ILayerVersion;
  readonly sharedCode: SharedAssetBundler;

  constructor(scope: Construct, id: string, props: SharedProps) {
    super(scope, id);

    const powerToolsLayerVersion = "46";

    this.defaultEnvironmentVariables = {
      POWERTOOLS_DEV: "false",
      LOG_LEVEL: "INFO",
      POWERTOOLS_LOGGER_LOG_EVENT: "true",
      POWERTOOLS_SERVICE_NAME: "chatbot",
    };

    let vpc: ec2.Vpc;
    if (!props.config.vpc?.vpcId) {
      vpc = new ec2.Vpc(this, "VPC", {
        natGateways: 1,
        restrictDefaultSecurityGroup: false,
        subnetConfiguration: [
          {
            name: "public",
            subnetType: ec2.SubnetType.PUBLIC,
          },
          {
            name: "private",
            subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          },
          {
            name: "isolated",
            subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          },
        ],
      });
    } else {
      vpc = ec2.Vpc.fromLookup(this, "VPC", {
        vpcId: props.config.vpc.vpcId,
      }) as ec2.Vpc;
    }

    if (
      typeof props.config.vpc?.createVpcEndpoints === "undefined" ||
      props.config.vpc?.createVpcEndpoints === true
    ) {
      // Create a VPC endpoint for S3.
      const s3GatewayEndpoint = vpc.addGatewayEndpoint("S3GatewayEndpoint", {
        service: ec2.GatewayVpcEndpointAwsService.S3,
      });

      const s3vpcEndpoint = vpc.addInterfaceEndpoint("S3InterfaceEndpoint", {
        service: ec2.InterfaceVpcEndpointAwsService.S3,
        privateDnsEnabled: true,
        open: true,
      });

      s3vpcEndpoint.node.addDependency(s3GatewayEndpoint);

      // Create a VPC endpoint for DynamoDB.
      vpc.addGatewayEndpoint("DynamoDBEndpoint", {
        service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
      });

      // Create VPC Endpoint for Secrets Manager
      vpc.addInterfaceEndpoint("SecretsManagerEndpoint", {
        service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
        open: true,
      });

      // Create VPC Endpoint for SageMaker Runtime
      vpc.addInterfaceEndpoint("SageMakerRuntimeEndpoint", {
        service: ec2.InterfaceVpcEndpointAwsService.SAGEMAKER_RUNTIME,
        open: true,
      });
    }

    const configParameter = new ssm.StringParameter(this, "Config", {
      stringValue: JSON.stringify(props.config),
    });

    const powerToolsArn =
      lambdaArchitecture === lambda.Architecture.X86_64
        ? `arn:${cdk.Aws.PARTITION}:lambda:${cdk.Aws.REGION}:017000801446:layer:AWSLambdaPowertoolsPythonV2:${powerToolsLayerVersion}`
        : `arn:${cdk.Aws.PARTITION}:lambda:${cdk.Aws.REGION}:017000801446:layer:AWSLambdaPowertoolsPythonV2-Arm64:${powerToolsLayerVersion}`;

    const powerToolsLayer = lambda.LayerVersion.fromLayerVersionArn(
      this,
      "PowertoolsLayer",
      powerToolsArn
    );

    const commonLayer = new Layer(this, "CommonLayer", {
      runtime: pythonRuntime,
      architecture: lambdaArchitecture,
      path: path.join(__dirname, "./layers/common"),
    });

    this.sharedCode = new SharedAssetBundler(this, "genai-core", [
      path.join(__dirname, "layers", "python-sdk", "python", "genai_core"),
    ]);

    const xOriginVerifySecret = new secretsmanager.Secret(
      this,
      "X-Origin-Verify-Secret",
      {
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        generateSecretString: {
          excludePunctuation: true,
          generateStringKey: "headerValue",
          secretStringTemplate: "{}",
        },
      }
    );

    const apiKeysSecret = new secretsmanager.Secret(this, "ApiKeysSecret", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      secretObjectValue: {},
    });

    this.vpc = vpc;
    this.configParameter = configParameter;
    this.xOriginVerifySecret = xOriginVerifySecret;
    this.apiKeysSecret = apiKeysSecret;
    this.powerToolsLayer = powerToolsLayer;
    this.commonLayer = commonLayer.layer;

    new cdk.CfnOutput(this, "ApiKeysSecretName", {
      value: apiKeysSecret.secretName,
    });
  }
}
