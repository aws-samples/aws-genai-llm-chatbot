import * as cdk from "aws-cdk-lib";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";
import {
  ContainerImages,
  DeploymentType,
  SageMakerModel,
} from "../sagemaker-model";
import { Shared } from "../shared";
import {
  Modality,
  ModelInterface,
  SageMakerModelEndpoint,
  SupportedSageMakerModels,
  SystemConfig,
} from "../shared/types";

export interface ModelsProps {
  readonly config: SystemConfig;
  readonly shared: Shared;
}

export class Models extends Construct {
  public readonly models: SageMakerModelEndpoint[];
  public readonly modelsParameter: ssm.StringParameter;

  constructor(scope: Construct, id: string, props: ModelsProps) {
    super(scope, id);

    const models: SageMakerModelEndpoint[] = [];

    if (
      props.config.llms?.sagemaker.includes(SupportedSageMakerModels.FalconLite)
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

      models.push({
        name: falconLite.endpoint.endpointName!,
        endpoint: falconLite.endpoint,
        responseStreamingSupported: false,
        inputModalities: [Modality.Text],
        outputModalities: [Modality.Text],
        interface: ModelInterface.LangChain,
        ragSupported: true,
      });
    }

    if (
      props.config.llms?.sagemaker.includes(
        SupportedSageMakerModels.Mistral7b_Instruct
      )
    ) {
      const mistral7bInstruct = new SageMakerModel(this, "Mistral7BInstruct", {
        vpc: props.shared.vpc,
        region: cdk.Aws.REGION,
        model: {
          type: DeploymentType.Container,
          modelId: "mistralai/Mistral-7B-Instruct-v0.1",
          container: ContainerImages.HF_PYTORCH_LLM_TGI_INFERENCE_1_1_0,
          instanceType: "ml.g5.2xlarge",
          containerStartupHealthCheckTimeoutInSeconds: 300,
          env: {
            SM_NUM_GPUS: JSON.stringify(1),
            MAX_INPUT_LENGTH: JSON.stringify(2048),
            MAX_TOTAL_TOKENS: JSON.stringify(4096),
            //HF_MODEL_QUANTIZE: "bitsandbytes",
          },
        },
      });

      models.push({
        name: mistral7bInstruct.endpoint.endpointName!,
        endpoint: mistral7bInstruct.endpoint,
        responseStreamingSupported: false,
        inputModalities: [Modality.Text],
        outputModalities: [Modality.Text],
        interface: ModelInterface.LangChain,
        ragSupported: true,
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
      props.config.llms?.sagemaker.includes(
        SupportedSageMakerModels.Llama2_13b_Chat
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
                  arn: `arn:aws:sagemaker:ap-southeast-1:192199979996:model-package/llama2-13b-f-v4-55c7c39a0cf535e8bad0d342598c219b`,
                },
                "ap-southeast-2": {
                  arn: `arn:aws:sagemaker:ap-southeast-2:666831318237:model-package/llama2-13b-f-v4-55c7c39a0cf535e8bad0d342598c219b`,
                },
                "eu-west-1": {
                  arn: `arn:aws:sagemaker:eu-west-1:985815980388:model-package/llama2-13b-f-v4-55c7c39a0cf535e8bad0d342598c219b`,
                },
                "us-east-1": {
                  arn: `arn:aws:sagemaker:us-east-1:865070037744:model-package/llama2-13b-f-v4-55c7c39a0cf535e8bad0d342598c219b`,
                },
                "us-east-2": {
                  arn: `arn:aws:sagemaker:us-east-2:057799348421:model-package/llama2-13b-f-v4-55c7c39a0cf535e8bad0d342598c219b`,
                },
                "us-west-2": {
                  arn: `arn:aws:sagemaker:us-west-2:594846645681:model-package/llama2-13b-f-v4-55c7c39a0cf535e8bad0d342598c219b`,
                },
              },
            }),
        },
      });

      models.push({
        name: "meta-LLama2-13b-chat",
        endpoint: llama2chat.endpoint,
        responseStreamingSupported: false,
        inputModalities: [Modality.Text],
        outputModalities: [Modality.Text],
        interface: ModelInterface.LangChain,
        ragSupported: true,
      });
    }

    if (
      props.config.llms?.sagemaker.includes(SupportedSageMakerModels.Idefics_9b)
    ) {
      const idefics9b = new SageMakerModel(this, "IDEFICS9B", {
        vpc: props.shared.vpc,
        region: cdk.Aws.REGION,
        model: {
          type: DeploymentType.Container,
          modelId: "HuggingFaceM4/idefics-9b-instruct",
          container: ContainerImages.HF_PYTORCH_LLM_TGI_INFERENCE_1_1_0,
          instanceType: "ml.g5.12xlarge",
          containerStartupHealthCheckTimeoutInSeconds: 300,
          env: {
            SM_NUM_GPUS: JSON.stringify(4),
            MAX_INPUT_LENGTH: JSON.stringify(1024),
            MAX_TOTAL_TOKENS: JSON.stringify(2048),
            MAX_BATCH_TOTAL_TOKENS: JSON.stringify(8192),
          },
        },
      });

      models.push({
        name: idefics9b.endpoint.endpointName!,
        endpoint: idefics9b.endpoint,
        responseStreamingSupported: false,
        inputModalities: [Modality.Text, Modality.Image],
        outputModalities: [Modality.Text],
        interface: ModelInterface.Idefics,
        ragSupported: false,
      });
    }

    if (
      props.config.llms?.sagemaker.includes(
        SupportedSageMakerModels.Idefics_80b
      )
    ) {
      const idefics80b = new SageMakerModel(this, "IDEFICS80B", {
        vpc: props.shared.vpc,
        region: cdk.Aws.REGION,
        model: {
          type: DeploymentType.Container,
          modelId: "HuggingFaceM4/idefics-80b-instruct",
          container: ContainerImages.HF_PYTORCH_LLM_TGI_INFERENCE_1_1_0,
          instanceType: "ml.g5.48xlarge",
          containerStartupHealthCheckTimeoutInSeconds: 600,
          env: {
            SM_NUM_GPUS: JSON.stringify(8),
            MAX_INPUT_LENGTH: JSON.stringify(1024),
            MAX_TOTAL_TOKENS: JSON.stringify(2048),
            MAX_BATCH_TOTAL_TOKENS: JSON.stringify(8192),
            // quantization required to work with ml.g5.48xlarge
            // comment if deploying with ml.p4d or ml.p4e instances
            HF_MODEL_QUANTIZE: "bitsandbytes",
          },
        },
      });

      models.push({
        name: idefics80b.endpoint.endpointName!,
        endpoint: idefics80b.endpoint,
        responseStreamingSupported: false,
        inputModalities: [Modality.Text, Modality.Image],
        outputModalities: [Modality.Text],
        interface: ModelInterface.Idefics,
        ragSupported: false,
      });
    }

    const modelsParameter = new ssm.StringParameter(this, "ModelsParameter", {
      stringValue: JSON.stringify(
        models.map((model) => ({
          name: model.name,
          endpoint: model.endpoint.endpointName,
          responseStreamingSupported: model.responseStreamingSupported,
          inputModalities: model.inputModalities,
          outputModalities: model.outputModalities,
          interface: model.interface,
          ragSupported: model.ragSupported,
        }))
      ),
    });

    this.models = models;
    this.modelsParameter = modelsParameter;
  }
}
