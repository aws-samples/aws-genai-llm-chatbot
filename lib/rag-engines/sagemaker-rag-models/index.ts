import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as path from "path";
import { DeploymentType, SageMakerModel } from "../../sagemaker-model";
import { Shared } from "../../shared";
import { SystemConfig } from "../../shared/types";

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

    if (
      sageMakerEmbeddingsModelIds?.length > 0 ||
      sageMakerCrossEncoderModelIds?.length > 0
    ) {
      const model = new SageMakerModel(this, "Model", {
        vpc: props.shared.vpc,
        region: cdk.Aws.REGION,
        logRetention: props.config.logRetention,
        kmsKey: props.shared.kmsKey,
        // NVMe based instances (like ml.g4dn.xlarge) do not support KMS encryption
        // They instead use an hardware module for encryption
        // https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/data-protection.html#encryption-rest
        enableEndpointKMSEncryption: false,
        retainOnDelete: props.config.retainOnDelete,
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
}
