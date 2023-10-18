import { Construct } from "constructs";

import { HuggingFaceCustomScriptModel } from "./hf-custom-script-model";
import { SageMakerModelProps, ModelCustomScriptConfig } from "./types";

export function deployCustomScriptModel(
  scope: Construct,
  props: SageMakerModelProps,
  modelConfig: ModelCustomScriptConfig
) {
  const { vpc, region } = props;
  const { modelId, instanceType, codeFolder, container, env } = modelConfig;

  const endpointName = (Array.isArray(modelId) ? modelId.join(",") : modelId)
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
  });

  return { model: llmModel.model, endpoint: llmModel.endpoint };
}
