export * from './container-images';
export * from './types';

import * as sagemaker from 'aws-cdk-lib/aws-sagemaker';
import { Construct } from 'constructs';

import { deployContainerModel } from './deploy-container-model';
import { deployCustomScriptModel } from './deploy-custom-script-model';
import { deployPackageModel } from './deploy-package-model';
import { LargeLanguageModelProps } from './types';

export class LargeLanguageModel extends Construct {
  public readonly endpoint: sagemaker.CfnEndpoint;
  public readonly modelId: string;

  constructor(scope: Construct, id: string, props: LargeLanguageModelProps) {
    super(scope, id);

    const { model } = props;
    this.modelId = model.modelId;

    if (model.kind == 'container') {
      const { endpoint } = deployContainerModel(this, props, model);
      this.endpoint = endpoint;
    } else if (model.kind == 'custom-script') {
      const { endpoint } = deployCustomScriptModel(this, props, model);
      this.endpoint = endpoint;
    } else if (model.kind == 'package') {
      const { endpoint } = deployPackageModel(this, props, model);
      this.endpoint = endpoint;
    }
  }
}
