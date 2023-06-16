import { Construct } from 'constructs';

import { HuggingFaceCustomScriptModel } from './hf-custom-script-model';
import { LargeLanguageModelProps, ModelCustomScriptConfig } from './types';

export function deployCustomScriptModel(scope: Construct, props: LargeLanguageModelProps, modelConfig: ModelCustomScriptConfig) {
  const { vpc, region } = props;
  const { modelId, instanceType, codeFolder, container, env } = modelConfig;

  const llmModel = new HuggingFaceCustomScriptModel(scope, modelId, {
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
