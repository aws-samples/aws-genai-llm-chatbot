import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as path from "path";
import { DeploymentType, SageMakerModel } from "../../sagemaker-model";
import { Shared } from "../../shared";
import { SystemConfig } from "../../shared/types";
import { NagSuppressions } from "cdk-nag";

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

    const model = new SageMakerModel(this, "Model", {
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
