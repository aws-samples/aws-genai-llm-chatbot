import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sagemaker from 'aws-cdk-lib/aws-sagemaker';
import { Construct } from 'constructs';

import { LargeLanguageModelProps, ModelPackageConfig } from './types';

export function deployPackageModel(scope: Construct, props: LargeLanguageModelProps, modelConfig: ModelPackageConfig) {
  const { vpc, region } = props;
  const { modelId, instanceType } = modelConfig;

  const executionRole = new iam.Role(scope, 'SageMakerExecutionRole', {
    assumedBy: new iam.ServicePrincipal('sagemaker.amazonaws.com'),
    managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSageMakerFullAccess')],
  });

  const modelPackageMapping = modelConfig.packages(scope);
  const modelPackageName = modelPackageMapping.findInMap(region, 'arn');

  const model = new sagemaker.CfnModel(scope, 'Model', {
    executionRoleArn: executionRole.roleArn,
    enableNetworkIsolation: true,
    primaryContainer: {
      modelPackageName,
    },
    vpcConfig: {
      subnets: vpc.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      }).subnetIds,
      securityGroupIds: [vpc.vpcDefaultSecurityGroup],
    },
  });

  const endpointConfig = new sagemaker.CfnEndpointConfig(scope, 'EndpointConfig', {
    productionVariants: [
      {
        instanceType,
        initialVariantWeight: 1,
        initialInstanceCount: 1,
        variantName: 'AllTraffic',
        modelName: model.getAtt('ModelName').toString(),
        containerStartupHealthCheckTimeoutInSeconds: 900,
      },
    ],
  });

  endpointConfig.addDependency(model);

  const endpoint = new sagemaker.CfnEndpoint(scope, modelId, {
    endpointConfigName: endpointConfig.getAtt('EndpointConfigName').toString(),
  });

  endpoint.addDependency(endpointConfig);

  return { model, endpoint };
}
