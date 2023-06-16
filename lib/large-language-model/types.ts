import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export interface LargeLanguageModelProps extends cdk.NestedStackProps {
  region: string;
  vpc: ec2.Vpc;
  model: ModelConfig;
}

export enum ModelKind {
  Container = 'container',
  CustomScript = 'custom-script',
  Package = 'package',
}

export type ModelConfig = ModelContainerConfig | ModelCustomScriptConfig | ModelPackageConfig;

export interface ModelConfigBase {
  modelId: string;
  instanceType: string;
}

export interface ModelContainerConfig extends ModelConfigBase {
  kind: ModelKind.Container;
  container?: string;
  env?: { [key: string]: string };
}

export interface ModelCustomScriptConfig extends ModelConfigBase {
  kind: ModelKind.CustomScript;
  codeFolder: string;
  container: string;
  env?: { [key: string]: string };
}

export interface ModelPackageConfig extends ModelConfigBase {
  kind: ModelKind.Package;
  packages: (scope: Construct) => cdk.CfnMapping;
}
