export * from "./container-images";
export * from "./types";
import * as sagemaker from "aws-cdk-lib/aws-sagemaker";
import { Construct } from "constructs";
import { deployCustomScriptModel } from "./deploy-custom-script-model";
import { DeploymentType, SageMakerModelProps } from "./types";

export class SageMakerModel extends Construct {
  public readonly endpoint: sagemaker.CfnEndpoint;
  public readonly modelId: string | string[];

  constructor(scope: Construct, id: string, props: SageMakerModelProps) {
    super(scope, id);

    const { model } = props;
    this.modelId = model.modelId;

    if (model.type == DeploymentType.CustomInferenceScript) {
      const { endpoint } = deployCustomScriptModel(this, props, model);
      this.endpoint = endpoint;
    } else {
      // Favor using the generative-ai-cdk-constructs library instead
      // It supports Jumpt start and hugghing face.
      throw new Error("Unsupported type");
    }
  }
}
