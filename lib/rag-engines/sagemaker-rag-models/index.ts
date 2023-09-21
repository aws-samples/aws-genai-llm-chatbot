import * as path from "path";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { SystemConfig } from "../../shared/types";
import { Shared } from "../../shared";
import { DeploymentType, SageMakerModel } from "../../sagemaker-model";

export interface SageMakerRagModelsProps {
  readonly config: SystemConfig;
  readonly shared: Shared;
}

export class SageMakerRagModels extends Construct {
  readonly model: SageMakerModel;

  constructor(scope: Construct, id: string, props: SageMakerRagModelsProps) {
    super(scope, id);

    const sageMakerEmbeddingsModelIds = props.config.rag.embeddingsModels
      .filter((c) => c.provider === "sagemaker")
      .map((c) => c.name);

    const sageMakerCrossEncoderModelIds = props.config.rag.crossEncoderModels
      .filter((c) => c.provider === "sagemaker")
      .map((c) => c.name);

    const model = new SageMakerModel(this, "Models", {
      vpc: props.shared.vpc,
      region: cdk.Aws.REGION,
      model: {
        type: DeploymentType.CustomInferenceScript,
        modelId: [
          ...sageMakerEmbeddingsModelIds,
          ...sageMakerCrossEncoderModelIds,
        ],
        codeFolder: path.join(__dirname, "./model"),
        instanceType: "ml.g4dn.xlarge",
      },
    });

    this.model = model;
  }
}
