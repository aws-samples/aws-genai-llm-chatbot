import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";
import * as path from "path";
import { Layer } from "../layer";
import { SystemConfig, SupportedBedrockRegion } from "./types";
import { SharedAssetBundler } from "./shared-asset-bundler";
import { NagSuppressions } from "cdk-nag";

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
  readonly s3vpcEndpoint: ec2.InterfaceVpcEndpoint;

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
      const logGroup = new logs.LogGroup(this, "FLowLogsLogGroup", {
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      });
      new ec2.FlowLog(this, "FlowLog", {
        resourceType: ec2.FlowLogResourceType.fromVpc(vpc),
        destination: ec2.FlowLogDestination.toCloudWatchLogs(logGroup),
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
      
      this.s3vpcEndpoint = s3vpcEndpoint;

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

      if (props.config.privateWebsite) {
        // Create VPC Endpoint for AppSync
        vpc.addInterfaceEndpoint("AppSyncEndpoint", {
            service: ec2.InterfaceVpcEndpointAwsService.APP_SYNC,
        });

        // Create VPC Endpoint for Lambda
        vpc.addInterfaceEndpoint("LambdaEndpoint", {
            service: ec2.InterfaceVpcEndpointAwsService.LAMBDA,
        });

        // Create VPC Endpoint for SNS
        vpc.addInterfaceEndpoint("SNSEndpoint", {
            service: ec2.InterfaceVpcEndpointAwsService.SNS,
        });

        // Create VPC Endpoint for Step Functions
        vpc.addInterfaceEndpoint("StepFunctionsEndpoint", {
            service: ec2.InterfaceVpcEndpointAwsService.STEP_FUNCTIONS,
        });

        // Create VPC Endpoint for SSM
        vpc.addInterfaceEndpoint("SSMEndpoint", {
            service: ec2.InterfaceVpcEndpointAwsService.SSM,
        });

        // Create VPC Endpoint for KMS
        vpc.addInterfaceEndpoint("KMSEndpoint", {
            service: ec2.InterfaceVpcEndpointAwsService.KMS,
        });

        // Create VPC Endpoint for Bedrock
        if (props.config.bedrock?.enabled && Object.values(SupportedBedrockRegion).some(val => val === cdk.Stack.of(this).region)){
          if (props.config.bedrock?.region !== cdk.Stack.of(this).region) {
            throw new Error(`Bedrock is only supported in the same region as the stack when using private website (Bedrock region: ${props.config.bedrock?.region}, Stack region: ${cdk.Stack.of(this).region}).`);
          }
          vpc.addInterfaceEndpoint("BedrockEndpoint", {
            service: new ec2.InterfaceVpcEndpointService('com.amazonaws.'+cdk.Aws.REGION+'.bedrock-runtime', 443),
            privateDnsEnabled: true
          });
        }

        // Create VPC Endpoint for Kendra
        if (props.config.rag.engines.kendra.enabled){
          vpc.addInterfaceEndpoint("KendraEndpoint", {
              service: ec2.InterfaceVpcEndpointAwsService.KENDRA,
          });
        }

        // Create VPC Endpoint for RDS/Aurora
        if (props.config.rag.engines.aurora.enabled) {
          vpc.addInterfaceEndpoint("RDSEndpoint", {
              service: ec2.InterfaceVpcEndpointAwsService.RDS,
          });

          // Create VPC Endpoint for RDS Data
          vpc.addInterfaceEndpoint("RDSDataEndpoint", {
              service: ec2.InterfaceVpcEndpointAwsService.RDS_DATA,
          });
        }

        // Create VPC Endpoints needed for Aurora & Opensearch Indexing
        if (props.config.rag.engines.aurora.enabled ||
          props.config.rag.engines.opensearch.enabled) {
          // Create VPC Endpoint for ECS
          vpc.addInterfaceEndpoint("ECSEndpoint", {
              service: ec2.InterfaceVpcEndpointAwsService.ECS,
          });

          // Create VPC Endpoint for Batch
          vpc.addInterfaceEndpoint("BatchEndpoint", {
              service: ec2.InterfaceVpcEndpointAwsService.BATCH,
          });

          // Create VPC Endpoint for EC2
          vpc.addInterfaceEndpoint("EC2Endpoint", {
              service: ec2.InterfaceVpcEndpointAwsService.EC2,
          });
        }
      }
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

    /**
     * CDK NAG suppression
     */
    NagSuppressions.addResourceSuppressions(xOriginVerifySecret, [
      { id: "AwsSolutions-SMG4", reason: "Secret is generated by CDK." },
    ]);
    NagSuppressions.addResourceSuppressions(apiKeysSecret, [
      { id: "AwsSolutions-SMG4", reason: "Secret value is blank." },
    ]);
  }
}
