import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as sagemaker from "aws-cdk-lib/aws-sagemaker";
import { Construct } from "constructs";

import { ContainerImages } from "./container-images";
import { ImageRepositoryMapping } from "./image-repository-mapping";
import { SageMakerModelProps, ModelContainerConfig } from "./types";
import { NagSuppressions } from "cdk-nag";

export function deployContainerModel(
  scope: Construct,
  props: SageMakerModelProps,
  modelConfig: ModelContainerConfig
) {
  const { region } = props;
  const {
    modelId,
    instanceType,
    containerStartupHealthCheckTimeoutInSeconds = 900,
    env = {},
  } = modelConfig;

  const executionRole = new iam.Role(scope, "SageMakerExecutionRole", {
    assumedBy: new iam.ServicePrincipal("sagemaker.amazonaws.com"),
    managedPolicies: [
      iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSageMakerFullAccess"),
    ],
  });

  const containerImage =
    modelConfig.container ||
    ContainerImages.HF_PYTORCH_LLM_TGI_INFERENCE_LATEST;
  const imageMapping = new ImageRepositoryMapping(
    scope,
    "ContainerModelMapping",
    { region }
  );
  const image = `${imageMapping.account}.dkr.ecr.${region}.amazonaws.com/${containerImage}`;

  const modelProps = {
    primaryContainer: {
      image,
      mode: "SingleModel",
      environment: {
        SAGEMAKER_CONTAINER_LOG_LEVEL: "20",
        SAGEMAKER_REGION: region,
        HF_MODEL_ID: modelId,
        ...env,
      },
    },
  };

  const model = new sagemaker.CfnModel(scope, "Model", {
    executionRoleArn: executionRole.roleArn,
    ...modelProps,
    vpcConfig: {
      securityGroupIds: [props.vpc.vpcDefaultSecurityGroup],
      subnets: props.vpc.privateSubnets.map((subnet) => subnet.subnetId),
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
