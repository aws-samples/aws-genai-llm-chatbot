import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { Shared } from "../shared";
import {
  ContainerImages,
  DeploymentType,
  SageMakerModel,
} from "../sagemaker-model";
import {
  SageMakerLLMEndpoint,
  SupportedSageMakerLLM,
  SystemConfig,
} from "../shared/types";
import * as ssm from "aws-cdk-lib/aws-ssm";

export interface LargeLanguageModelsProps {
  readonly config: SystemConfig;
  readonly shared: Shared;
}

export class LargeLanguageModels extends Construct {
  public readonly llms: SageMakerLLMEndpoint[];
  public readonly llmsParameter: ssm.StringParameter;

  constructor(scope: Construct, id: string, props: LargeLanguageModelsProps) {
    super(scope, id);

    const llms: SageMakerLLMEndpoint[] = [];

    if (
      props.config.llms?.sagemaker.includes(SupportedSageMakerLLM.FalconLite)
    ) {
      const falconLite = new SageMakerModel(this, "FalconLite", {
        vpc: props.shared.vpc,
        region: cdk.Aws.REGION,
        model: {
          type: DeploymentType.Container,
          modelId: "amazon/FalconLite",
          container: ContainerImages.HF_PYTORCH_LLM_TGI_INFERENCE_0_9_3,
          instanceType: "ml.g5.12xlarge",
          // https://github.com/awslabs/extending-the-context-length-of-open-source-llms/blob/main/custom-tgi-ecr/deploy.ipynb
          containerStartupHealthCheckTimeoutInSeconds: 600,
          env: {
            SM_NUM_GPUS: JSON.stringify(4),
            MAX_INPUT_LENGTH: JSON.stringify(12000),
            MAX_TOTAL_TOKENS: JSON.stringify(12001),
            HF_MODEL_QUANTIZE: "gptq",
            TRUST_REMOTE_CODE: JSON.stringify(true),
            MAX_BATCH_PREFILL_TOKENS: JSON.stringify(12001),
            MAX_BATCH_TOTAL_TOKENS: JSON.stringify(12001),
            GPTQ_BITS: JSON.stringify(4),
            GPTQ_GROUPSIZE: JSON.stringify(128),
            DNTK_ALPHA_SCALER: JSON.stringify(0.25),
          },
        },
      });

      llms.push({
        name: "amazon-FalconLite",
        endpoint: falconLite.endpoint,
      });
    }

    // To get Jumpstart model ARNs do the following
    // 1. Identify the modelId via https://sagemaker.readthedocs.io/en/stable/doc_utils/pretrainedmodels.html
    // 2. Run the following code
    //
    //      from sagemaker.jumpstart.model import JumpStartModel
    //      region = 'us-east-1'
    //      model_id = 'meta-textgeneration-llama-2-13b'
    //      model = JumpStartModel(model_id=model_id, region=region)
    //      print(model.model_package_arn)

    if (
      props.config.llms?.sagemaker.includes(
        SupportedSageMakerLLM.Llama2_13b_Base
      )
    ) {
      const llama2base = new SageMakerModel(this, "LLamaV2_13B_Base", {
        vpc: props.shared.vpc,
        region: cdk.Aws.REGION,
        model: {
          type: DeploymentType.ModelPackage,
          modelId: "meta-LLama2-13b-base",
          instanceType: "ml.g5.12xlarge",
          packages: (scope) =>
            new cdk.CfnMapping(scope, "Llama2BasePackageMapping", {
              lazy: true,
              mapping: {
                "ap-southeast-1": {
                  arn: "arn:aws:sagemaker:ap-southeast-1:192199979996:model-package/llama2-13b-v4-c4de6690de6132cb962827bec6ef6811",
                },
                "ap-southeast-2": {
                  arn: "arn:aws:sagemaker:ap-southeast-2:666831318237:model-package/llama2-13b-v4-c4de6690de6132cb962827bec6ef6811",
                },
                "eu-west-1": {
                  arn: "arn:aws:sagemaker:eu-west-1:985815980388:model-package/llama2-13b-v4-c4de6690de6132cb962827bec6ef6811",
                },
                "us-east-1": {
                  arn: "arn:aws:sagemaker:us-east-1:865070037744:model-package/llama2-13b-v4-c4de6690de6132cb962827bec6ef6811",
                },
                "us-east-2": {
                  arn: "arn:aws:sagemaker:us-east-2:057799348421:model-package/llama2-13b-v4-c4de6690de6132cb962827bec6ef6811",
                },
                "us-west-2": {
                  arn: "arn:aws:sagemaker:us-west-2:594846645681:model-package/llama2-13b-v4-c4de6690de6132cb962827bec6ef6811",
                },
              },
            }),
        },
      });

      llms.push({
        name: "meta-LLama2-13b-base",
        endpoint: llama2base.endpoint,
      });
    }

    // To get Jumpstart model ARNs do the following
    // 1. Identify the modelId via https://sagemaker.readthedocs.io/en/stable/doc_utils/pretrainedmodels.html
    // 2. Run the following code
    //
    //      from sagemaker.jumpstart.model import JumpStartModel
    //      region = 'us-east-1'
    //      model_id = 'meta-textgeneration-llama-2-13b-f'
    //      model = JumpStartModel(model_id=model_id, region=region)
    //      print(model.model_package_arn)
    if (
      props.config.llms.sagemaker.includes(
        SupportedSageMakerLLM.Llama2_13b_Chat
      )
    ) {
      const llama2chat = new SageMakerModel(this, "LLamaV2_13B_Chat", {
        vpc: props.shared.vpc,
        region: cdk.Aws.REGION,
        model: {
          type: DeploymentType.ModelPackage,
          modelId: "meta-LLama2-13b-chat",
          instanceType: "ml.g5.12xlarge",
          packages: (scope) =>
            new cdk.CfnMapping(scope, "Llama2ChatPackageMapping", {
              lazy: true,
              mapping: {
                "ap-southeast-1": {
                  arn: "arn:aws:sagemaker:ap-southeast-1:192199979996:model-package/llama2-13b-f-v4-55c7c39a0cf535e8bad0d342598c219b",
                },
                "ap-southeast-2": {
                  arn: "arn:aws:sagemaker:ap-southeast-2:666831318237:model-package/llama2-13b-f-v4-55c7c39a0cf535e8bad0d342598c219b",
                },
                "eu-west-1": {
                  arn: "arn:aws:sagemaker:eu-west-1:985815980388:model-package/llama2-13b-f-v4-55c7c39a0cf535e8bad0d342598c219b",
                },
                "us-east-1": {
                  arn: "arn:aws:sagemaker:us-east-1:865070037744:model-package/llama2-13b-f-v4-55c7c39a0cf535e8bad0d342598c219b",
                },
                "us-east-2": {
                  arn: "arn:aws:sagemaker:us-east-2:057799348421:model-package/llama2-13b-f-v4-55c7c39a0cf535e8bad0d342598c219b",
                },
                "us-west-2": {
                  arn: "arn:aws:sagemaker:us-west-2:594846645681:model-package/llama2-13b-f-v4-55c7c39a0cf535e8bad0d342598c219b",
                },
              },
            }),
        },
      });

      llms.push({
        name: "meta-LLama2-13b-chat",
        endpoint: llama2chat.endpoint,
      });
    }

    const llmsParameter = new ssm.StringParameter(this, "LLMsParameter", {
      stringValue: JSON.stringify(
        llms.map((model) => ({
          name: model.name,
          endpoint: model.endpoint.endpointName,
        }))
      ),
    });

    this.llms = llms;
    this.llmsParameter = llmsParameter;
  }
}
