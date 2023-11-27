import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import * as servicecatalog from "aws-cdk-lib/aws-servicecatalog";
import { Modality, ModelInterface } from "../shared/types";

export interface SageMakerModelProps extends servicecatalog.ProductStackProps {
  vpc?: ec2.Vpc;
  vpcId?: string;
  privateSubnets?: string[];
  securityGroupId: string;
  region: string;
  model: ModelConfig;
  responseStreamingSupported?: boolean;
  inputModalities?: Modality[];
  outputModalities?: Modality[];
  interface?: ModelInterface;
  ragSupported?: boolean;
  apiHandler?: lambda.Function;
  modelName?: string;
}

export interface SageMakerModelProductProps extends SageMakerModelProps {}

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
