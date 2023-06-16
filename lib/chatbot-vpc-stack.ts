import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export class ChatBotVpcStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'VPC', {
      natGateways: 1,
      flowLogs: {
        FlowLogGroup: {
          trafficType: ec2.FlowLogTrafficType.REJECT,
          destination: ec2.FlowLogDestination.toCloudWatchLogs(),
        },
      },
      subnetConfiguration: [
        {
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          name: 'private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          name: 'isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    // Create VPC Endpoint for SageMaker Runtime
    new ec2.InterfaceVpcEndpoint(this, 'SageMakerRuntimeEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.SAGEMAKER_RUNTIME,
      vpc: vpc,
      open: true,
    });

    // Create VPC Endpoint for S3
    const s3GatewayEndpoint = new ec2.GatewayVpcEndpoint(this, 'S3GatewayEndpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
      vpc: vpc,
    });
    const s3InterfaceEndpoint = new ec2.InterfaceVpcEndpoint(this, 'S3Endpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.S3,
      vpc: vpc,
      subnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      open: true,
    });
    s3InterfaceEndpoint.node.addDependency(s3GatewayEndpoint);

    // Create VPC Endpoint for Secrets Manager
    new ec2.InterfaceVpcEndpoint(this, 'SecretsManagerEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
      vpc: vpc,
      subnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      open: true,
    });

    this.vpc = vpc;
  }
}
