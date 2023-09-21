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
  SupportedLLM,
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

    if (props.config.llms.includes(SupportedLLM.FalconLite)) {
      const falconLite = new SageMakerModel(this, "FalconLite", {
        vpc: props.shared.vpc,
        region: cdk.Aws.REGION,
        model: {
          type: DeploymentType.Container,
          modelId: "amazon/FalconLite",
          container: ContainerImages.HF_PYTORCH_LLM_TGI_INFERENCE_LATEST,
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

    if (props.config.llms.includes(SupportedLLM.Llama2_13b_Base)) {
      const llama2base = new SageMakerModel(this, "LLamaV2_13B_Base", {
        vpc: props.shared.vpc,
        region: cdk.Aws.REGION,
        model: {
          type: DeploymentType.ModelPackage,
          modelId: "meta-LLama2-13b",
          instanceType: "ml.g5.12xlarge",
          packages: (scope) =>
            new cdk.CfnMapping(scope, "Llama2BasePackageMapping", {
              lazy: true,
              mapping: {
                "eu-west-1": {
                  arn: "arn:aws:sagemaker:eu-west-1:985815980388:model-package/llama2-13b-v3-8f4d5693a64a320ab0e8207af3551ae4",
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

    if (props.config.llms.includes(SupportedLLM.Llama2_13b_Chat)) {
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
                "eu-west-1": {
                  arn: "arn:aws:sagemaker:eu-west-1:985815980388:model-package/llama2-13b-f-v3-626aff9802aa3ed3ae74f5e2f1da8e77",
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
