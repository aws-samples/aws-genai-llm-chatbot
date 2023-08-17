import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export class Vpc extends Construct {
  public readonly vpc: ec2.Vpc;
  public readonly s3GatewayEndpoint: ec2.IGatewayVpcEndpoint;
  public readonly s3vpcEndpoint: ec2.IGatewayVpcEndpoint;
  public readonly dynamodbvpcEndpoint: ec2.IGatewayVpcEndpoint;
  public readonly secretsManagerVpcEndpoint: ec2.IInterfaceVpcEndpoint;
  public readonly sagemakerRuntimeVpcEndpoint: ec2.IInterfaceVpcEndpoint;
  public readonly apiGatewayVpcEndpoint: ec2.IInterfaceVpcEndpoint;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const vpc = new ec2.Vpc(this, 'VPC', {
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

    // Create a VPC endpoint for S3.
    this.s3GatewayEndpoint = vpc.addGatewayEndpoint('S3GatewayEndpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
    });

    this.s3vpcEndpoint = vpc.addInterfaceEndpoint('S3InterfaceEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.S3,
      open: true,
    });
    this.s3vpcEndpoint.node.addDependency(this.s3GatewayEndpoint);

    // Create a VPC endpoint for DynamoDB.
    this.dynamodbvpcEndpoint = vpc.addGatewayEndpoint('DynamoDBEndpoint', {
      service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
    });

    // Create VPC Endpoint for Secrets Manager
    this.secretsManagerVpcEndpoint = vpc.addInterfaceEndpoint('SecretsManagerEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
      open: true,
    });

    // Create VPC Endpoint for SageMaker Runtime
    this.sagemakerRuntimeVpcEndpoint = vpc.addInterfaceEndpoint('SageMakerRuntimeEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.SAGEMAKER_RUNTIME,
      open: true,
    });

    this.vpc = vpc;
  }
}
