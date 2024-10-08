import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as kms from "aws-cdk-lib/aws-kms";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

export interface SageMakerModelProps extends cdk.NestedStackProps {
  vpc: ec2.Vpc;
  region: string;
  model: ModelConfig;
  logRetention?: number;
  kmsKey?: kms.Key;
  retainOnDelete?: boolean;
  enableEndpointKMSEncryption: boolean;
}

export enum DeploymentType {
  Container = "container",
  ModelPackage = "model-package",
  CustomInferenceScript = "custom-inference-script",
}

export type ModelConfig =
  | ModelContainerConfig
  | ModelPackageConfig
  | ModelCustomScriptConfig;

export interface ModelConfigBase {
  modelId: string;
  instanceType: string;
}

export interface ModelContainerConfig extends ModelConfigBase {
  type: DeploymentType.Container;
  container?: string;
  env?: { [key: string]: string };
  containerStartupHealthCheckTimeoutInSeconds?: number;
}

export interface ModelPackageConfig extends ModelConfigBase {
  type: DeploymentType.ModelPackage;
  packages: (scope: Construct) => cdk.CfnMapping;
  containerStartupHealthCheckTimeoutInSeconds?: number;
}

export interface ModelCustomScriptConfig
  extends Omit<ModelConfigBase, "modelId"> {
  type: DeploymentType.CustomInferenceScript;
  modelId: string | string[];
  codeFolder: string;
  container?: string;
  env?: { [key: string]: string };
  architecture?: lambda.Architecture;
  runtime?: lambda.Runtime;
}
