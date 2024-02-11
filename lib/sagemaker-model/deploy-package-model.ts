import * as iam from "aws-cdk-lib/aws-iam";
import * as sagemaker from "aws-cdk-lib/aws-sagemaker";
import { Construct } from "constructs";

import { SageMakerModelProps, ModelPackageConfig } from "./types";
import { NagSuppressions } from "cdk-nag";

export function deployPackageModel(
  scope: Construct,
  props: SageMakerModelProps,
  modelConfig: ModelPackageConfig
) {
  const { region } = props;
  const {
    modelId,
    instanceType,
    containerStartupHealthCheckTimeoutInSeconds = 900,
  } = modelConfig;

  const executionRole = new iam.Role(scope, "SageMakerExecutionRole", {
    assumedBy: new iam.ServicePrincipal("sagemaker.amazonaws.com"),
    managedPolicies: [
      iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSageMakerFullAccess"),
    ],
  });

  const modelPackageMapping = modelConfig.packages(scope);
  const modelPackageName = modelPackageMapping.findInMap(region, "arn");

  const model = new sagemaker.CfnModel(scope, "Model", {
    executionRoleArn: executionRole.roleArn,
    enableNetworkIsolation: true,
    primaryContainer: {
      modelPackageName,
    },
  });

  const endpointConfig = new sagemaker.CfnEndpointConfig(
    scope,
    "EndpointConfig",
    {
      productionVariants: [
        {
          instanceType,
          initialVariantWeight: 1,
          initialInstanceCount: 1,
          variantName: "AllTraffic",
          modelName: model.getAtt("ModelName").toString(),
          containerStartupHealthCheckTimeoutInSeconds,
        },
      ],
    }
  );

  endpointConfig.addDependency(model);

  const endpoint = new sagemaker.CfnEndpoint(scope, modelId, {
    endpointConfigName: endpointConfig.getAtt("EndpointConfigName").toString(),
    endpointName: modelId.split("/").join("-").split(".").join("-"),
  });

  endpoint.addDependency(endpointConfig);

  /**
   * CDK NAG suppression
   */
  NagSuppressions.addResourceSuppressions(executionRole, [
    {
      id: "AwsSolutions-IAM4",
      reason: "Gives user ability to deploy and delete endpoints from the UI.",
    },
    {
      id: "AwsSolutions-IAM5",
      reason: "Gives user ability to deploy and delete endpoints from the UI.",
    },
  ]);

  return { model, endpoint };
}
