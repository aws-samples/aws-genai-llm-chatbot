export * from "./container-images";
export * from "./types";
import * as sagemaker from "aws-cdk-lib/aws-sagemaker";
import { Construct } from "constructs";
import { deployContainerModel } from "./deploy-container-model";
import { deployCustomScriptModel } from "./deploy-custom-script-model";
import { deployPackageModel } from "./deploy-package-model";
import { DeploymentType, SageMakerModelProps } from "./types";

export class SageMakerModel extends Construct {
  public readonly endpoint: sagemaker.CfnEndpoint;
  public readonly modelId: string | string[];

  constructor(scope: Construct, id: string, props: SageMakerModelProps) {
    super(scope, id);

    const { model } = props;
    this.modelId = model.modelId;

    if (model.type == DeploymentType.Container) {
      const { endpoint } = deployContainerModel(this, props, model);
      this.endpoint = endpoint;
    } else if (model.type == DeploymentType.ModelPackage) {
      const { endpoint } = deployPackageModel(this, props, model);
      this.endpoint = endpoint;
    } else if (model.type == DeploymentType.CustomInferenceScript) {
      const { endpoint } = deployCustomScriptModel(this, props, model);
      this.endpoint = endpoint;
    }
  }
}
