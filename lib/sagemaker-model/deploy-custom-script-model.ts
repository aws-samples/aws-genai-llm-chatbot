import { Construct } from "constructs";

import { HuggingFaceCustomScriptModel } from "./hf-custom-script-model";
import { SageMakerModelProps, ModelCustomScriptConfig } from "./types";
import { createHash } from "crypto";

export function deployCustomScriptModel(
  scope: Construct,
  props: SageMakerModelProps,
  modelConfig: ModelCustomScriptConfig
) {
  const {
    vpc,
    region,
    logRetention,
    kmsKey,
    retainOnDelete,
    enableEndpointKMSEncryption,
  } = props;
  const { modelId, instanceType, codeFolder, container, env } = modelConfig;

  const endpointName = (
    Array.isArray(modelId)
      ? `Multi${createHash("md5") // NOSONAR Not sensitive (naming)
          .update(modelId.join(","))
          .digest("hex")
          .toUpperCase()
          .slice(-5)}`
      : modelId
  )
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(-10);
  const llmModel = new HuggingFaceCustomScriptModel(scope, endpointName, {
    vpc,
    region,
    modelId,
    instanceType,
    codeFolder,
    container,
    env,
    kmsKey,
    retainOnDelete,
    logRetention,
    enableEndpointKMSEncryption,
  });

  return { model: llmModel.model, endpoint: llmModel.endpoint };
}
