import * as ssm from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Shared } from "../shared";
import {
  Modality,
  ModelInterface,
  SageMakerModelEndpoint,
  SupportedSageMakerModels,
  SystemConfig,
} from "../shared/types";
import {
  HuggingFaceSageMakerEndpoint,
  JumpStartSageMakerEndpoint,
  SageMakerInstanceType,
  DeepLearningContainerImage,
  JumpStartModel,
} from "@cdklabs/generative-ai-cdk-constructs";
import { NagSuppressions } from "cdk-nag";
import { createStartSchedule, createStopSchedule } from "./sagemaker-schedule";

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

    let hfTokenSecret: secretsmanager.Secret | undefined;
    if (props.config.llms.huggingfaceApiSecretArn) {
      hfTokenSecret = secretsmanager.Secret.fromSecretCompleteArn(
        this,
        "HFTokenSecret",
        props.config.llms.huggingfaceApiSecretArn
      ) as secretsmanager.Secret;
    }
    if (
      props.config.llms?.sagemaker.includes(SupportedSageMakerModels.FalconLite)
    ) {
      const FALCON_MODEL_ID = "amazon/FalconLite";
      const FALCON_ENDPOINT_NAME = FALCON_MODEL_ID.split("/")
        .join("-")
        .split(".")
        .join("-");

      const falconLite = new HuggingFaceSageMakerEndpoint(this, "FalconLite", {
        modelId: FALCON_MODEL_ID,
        vpcConfig: {
          securityGroupIds: [props.shared.vpc.vpcDefaultSecurityGroup],
          subnets: props.shared.vpc.privateSubnets.map(
            (subnet) => subnet.subnetId
          ),
        },
        container:
          DeepLearningContainerImage.HUGGINGFACE_PYTORCH_TGI_INFERENCE_2_0_1_TGI0_9_3_GPU_PY39_CU118_UBUNTU20_04,
        instanceType: SageMakerInstanceType.ML_G5_12XLARGE,
        startupHealthCheckTimeoutInSeconds: 600,
        endpointName: FALCON_ENDPOINT_NAME,
        environment: {
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
      });

      this.suppressCdkNagWarningForEndpointRole(falconLite.role);

      models.push({
        name: FALCON_ENDPOINT_NAME!,
        endpoint: falconLite.cfnEndpoint,
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
      const MISTRAL_7B_MODEL_ID = "mistralai/Mistral-7B-Instruct-v0.1";
      const MISTRAL_7B_ENDPOINT_NAME = MISTRAL_7B_MODEL_ID.split("/")
        .join("-")
        .split(".")
        .join("-");

      const mistral7B = new HuggingFaceSageMakerEndpoint(
        this,
        "Mistral7BInstruct",
        {
          modelId: MISTRAL_7B_MODEL_ID,
          vpcConfig: {
            securityGroupIds: [props.shared.vpc.vpcDefaultSecurityGroup],
            subnets: props.shared.vpc.privateSubnets.map(
              (subnet) => subnet.subnetId
            ),
          },
          container:
            DeepLearningContainerImage.HUGGINGFACE_PYTORCH_TGI_INFERENCE_2_1_1_TGI2_0_0_GPU_PY310_CU121_UBUNTU22_04,
          instanceType: SageMakerInstanceType.ML_G5_2XLARGE,
          startupHealthCheckTimeoutInSeconds: 300,
          endpointName: MISTRAL_7B_ENDPOINT_NAME,
          environment: {
            HF_TOKEN:
              hfTokenSecret?.secretValue.unsafeUnwrap().toString() || "",
            SM_NUM_GPUS: JSON.stringify(1),
            MAX_INPUT_LENGTH: JSON.stringify(2048),
            MAX_TOTAL_TOKENS: JSON.stringify(4096),
          },
        }
      );

      this.suppressCdkNagWarningForEndpointRole(mistral7B.role);

      models.push({
        name: MISTRAL_7B_ENDPOINT_NAME!,
        endpoint: mistral7B.cfnEndpoint,
        responseStreamingSupported: false,
        inputModalities: [Modality.Text],
        outputModalities: [Modality.Text],
        interface: ModelInterface.LangChain,
        ragSupported: true,
      });
    }

    if (
      props.config.llms?.sagemaker.includes(
        SupportedSageMakerModels.Mistral7b_Instruct2
      )
    ) {
      const MISTRAL_7B_INSTRUCT2_MODEL_ID =
        "mistralai/Mistral-7B-Instruct-v0.2";
      const MISTRAL_7B_INSTRUCT2_ENDPOINT_NAME =
        MISTRAL_7B_INSTRUCT2_MODEL_ID.split("/").join("-").split(".").join("-");

      const mistral7BInstruct2 = new HuggingFaceSageMakerEndpoint(
        this,
        "Mistral7BInstruct2",
        {
          modelId: MISTRAL_7B_INSTRUCT2_MODEL_ID,
          vpcConfig: {
            securityGroupIds: [props.shared.vpc.vpcDefaultSecurityGroup],
            subnets: props.shared.vpc.privateSubnets.map(
              (subnet) => subnet.subnetId
            ),
          },
          container:
            DeepLearningContainerImage.HUGGINGFACE_PYTORCH_TGI_INFERENCE_2_1_1_TGI2_0_0_GPU_PY310_CU121_UBUNTU22_04,
          instanceType: SageMakerInstanceType.ML_G5_2XLARGE,
          startupHealthCheckTimeoutInSeconds: 300,
          endpointName: MISTRAL_7B_INSTRUCT2_ENDPOINT_NAME,
          environment: {
            HF_TOKEN:
              hfTokenSecret?.secretValue.unsafeUnwrap().toString() || "",
            SM_NUM_GPUS: JSON.stringify(1),
            MAX_INPUT_LENGTH: JSON.stringify(2048),
            MAX_TOTAL_TOKENS: JSON.stringify(4096),
            MAX_CONCURRENT_REQUESTS: JSON.stringify(4),
          },
        }
      );

      this.suppressCdkNagWarningForEndpointRole(mistral7BInstruct2.role);

      models.push({
        name: MISTRAL_7B_INSTRUCT2_ENDPOINT_NAME!,
        endpoint: mistral7BInstruct2.cfnEndpoint,
        responseStreamingSupported: false,
        inputModalities: [Modality.Text],
        outputModalities: [Modality.Text],
        interface: ModelInterface.LangChain,
        ragSupported: true,
      });
    }

    if (
      props.config.llms?.sagemaker.includes(
        SupportedSageMakerModels.Mixtral_8x7b_Instruct
      )
    ) {
      const MISTRAL_8x7B_MODEL_ID = "mistralai/Mixtral-8x7B-Instruct-v0.1";
      const MISTRAL_8x7B_INSTRUCT2_ENDPOINT_NAME = MISTRAL_8x7B_MODEL_ID.split(
        "/"
      )
        .join("-")
        .split(".")
        .join("-");

      const mistral8x7B = new HuggingFaceSageMakerEndpoint(
        this,
        "Mixtral8x7binstruct",
        {
          modelId: MISTRAL_8x7B_MODEL_ID,
          vpcConfig: {
            securityGroupIds: [props.shared.vpc.vpcDefaultSecurityGroup],
            subnets: props.shared.vpc.privateSubnets.map(
              (subnet) => subnet.subnetId
            ),
          },
          container:
            DeepLearningContainerImage.HUGGINGFACE_PYTORCH_TGI_INFERENCE_2_1_1_TGI2_0_0_GPU_PY310_CU121_UBUNTU22_04,
          instanceType: SageMakerInstanceType.ML_G5_48XLARGE,
          startupHealthCheckTimeoutInSeconds: 300,
          endpointName: MISTRAL_8x7B_INSTRUCT2_ENDPOINT_NAME,
          environment: {
            HF_TOKEN:
              hfTokenSecret?.secretValue.unsafeUnwrap().toString() || "",
            SM_NUM_GPUS: JSON.stringify(8),
            MAX_INPUT_LENGTH: JSON.stringify(24576),
            MAX_TOTAL_TOKENS: JSON.stringify(32768),
            MAX_BATCH_PREFILL_TOKENS: JSON.stringify(24576),
            MAX_CONCURRENT_REQUESTS: JSON.stringify(4),
          },
        }
      );

      this.suppressCdkNagWarningForEndpointRole(mistral8x7B.role);

      models.push({
        name: MISTRAL_8x7B_INSTRUCT2_ENDPOINT_NAME!,
        endpoint: mistral8x7B.cfnEndpoint,
        responseStreamingSupported: false,
        inputModalities: [Modality.Text],
        outputModalities: [Modality.Text],
        interface: ModelInterface.LangChain,
        ragSupported: true,
      });
    }

    if (
      props.config.llms?.sagemaker.includes(
        SupportedSageMakerModels.Mistral7b_Instruct3
      )
    ) {
      const MISTRACL_7B_3_ENDPOINT_NAME = "mistralai/Mistral-7B-Instruct-v0.3";

      const mistral7BInstruct3 = new JumpStartSageMakerEndpoint(
        this,
        "Mistral7b_Instruct3",
        {
          model: JumpStartModel.HUGGINGFACE_LLM_MISTRAL_7B_INSTRUCT_3_0_0,
          instanceType: SageMakerInstanceType.ML_G5_2XLARGE,
          vpcConfig: {
            securityGroupIds: [props.shared.vpc.vpcDefaultSecurityGroup],
            subnets: props.shared.vpc.privateSubnets.map(
              (subnet) => subnet.subnetId
            ),
          },
          endpointName: "Mistral-7B-Instruct-v0-3",
        }
      );

      this.suppressCdkNagWarningForEndpointRole(mistral7BInstruct3.role);

      models.push({
        name: MISTRACL_7B_3_ENDPOINT_NAME,
        endpoint: mistral7BInstruct3.cfnEndpoint,
        responseStreamingSupported: false,
        inputModalities: [Modality.Text],
        outputModalities: [Modality.Text],
        interface: ModelInterface.LangChain,
        ragSupported: true,
      });
    }

    if (
      props.config.llms?.sagemaker.includes(
        SupportedSageMakerModels.Llama2_13b_Chat
      )
    ) {
      const LLAMA2_13B_CHAT_ENDPOINT_NAME = "meta-LLama2-13b-chat";

      const llama2_13b_chat = new JumpStartSageMakerEndpoint(
        this,
        "LLamaV2_13B_Chat",
        {
          model: JumpStartModel.META_TEXTGENERATION_LLAMA_2_13B_F_2_0_2,
          instanceType: SageMakerInstanceType.ML_G5_12XLARGE,
          vpcConfig: {
            securityGroupIds: [props.shared.vpc.vpcDefaultSecurityGroup],
            subnets: props.shared.vpc.privateSubnets.map(
              (subnet) => subnet.subnetId
            ),
          },
          endpointName: LLAMA2_13B_CHAT_ENDPOINT_NAME,
        }
      );

      this.suppressCdkNagWarningForEndpointRole(llama2_13b_chat.role);

      models.push({
        name: LLAMA2_13B_CHAT_ENDPOINT_NAME,
        endpoint: llama2_13b_chat.cfnEndpoint,
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
      const IDEFICS_9B_MODEL_ID = "HuggingFaceM4/idefics-9b-instruct";
      const IDEFICS_9B_ENDPOINT_NAME = IDEFICS_9B_MODEL_ID.split("/")
        .join("-")
        .split(".")
        .join("-");

      const idefics9b = new HuggingFaceSageMakerEndpoint(this, "IDEFICS9B", {
        modelId: IDEFICS_9B_MODEL_ID,
        vpcConfig: {
          securityGroupIds: [props.shared.vpc.vpcDefaultSecurityGroup],
          subnets: props.shared.vpc.privateSubnets.map(
            (subnet) => subnet.subnetId
          ),
        },
        container:
          DeepLearningContainerImage.HUGGINGFACE_PYTORCH_TGI_INFERENCE_2_0_1_TGI1_1_0_GPU_PY39_CU118_UBUNTU20_04,
        instanceType: SageMakerInstanceType.ML_G5_12XLARGE,
        startupHealthCheckTimeoutInSeconds: 300,
        endpointName: IDEFICS_9B_ENDPOINT_NAME,
        environment: {
          SM_NUM_GPUS: JSON.stringify(4),
          MAX_INPUT_LENGTH: JSON.stringify(1024),
          MAX_TOTAL_TOKENS: JSON.stringify(2048),
          MAX_BATCH_TOTAL_TOKENS: JSON.stringify(8192),
        },
      });

      this.suppressCdkNagWarningForEndpointRole(idefics9b.role);

      models.push({
        name: IDEFICS_9B_ENDPOINT_NAME!,
        endpoint: idefics9b.cfnEndpoint,
        responseStreamingSupported: false,
        inputModalities: [Modality.Text, Modality.Image],
        outputModalities: [Modality.Text],
        interface: ModelInterface.MultiModal,
        ragSupported: false,
      });
    }

    if (
      props.config.llms?.sagemaker.includes(
        SupportedSageMakerModels.Idefics_80b
      )
    ) {
      const IDEFICS_80B_MODEL_ID = "HuggingFaceM4/idefics-80b-instruct";
      const IDEFICS_80B_ENDPOINT_NAME = IDEFICS_80B_MODEL_ID.split("/")
        .join("-")
        .split(".")
        .join("-");

      const idefics80b = new HuggingFaceSageMakerEndpoint(this, "IDEFICS80B", {
        modelId: IDEFICS_80B_MODEL_ID,
        vpcConfig: {
          securityGroupIds: [props.shared.vpc.vpcDefaultSecurityGroup],
          subnets: props.shared.vpc.privateSubnets.map(
            (subnet) => subnet.subnetId
          ),
        },
        container:
          DeepLearningContainerImage.HUGGINGFACE_PYTORCH_TGI_INFERENCE_2_0_1_TGI1_1_0_GPU_PY39_CU118_UBUNTU20_04,
        instanceType: SageMakerInstanceType.ML_G5_48XLARGE,
        startupHealthCheckTimeoutInSeconds: 600,
        endpointName: IDEFICS_80B_ENDPOINT_NAME,
        environment: {
          SM_NUM_GPUS: JSON.stringify(8),
          MAX_INPUT_LENGTH: JSON.stringify(1024),
          MAX_TOTAL_TOKENS: JSON.stringify(2048),
          MAX_BATCH_TOTAL_TOKENS: JSON.stringify(8192),
          // quantization required to work with ml.g5.48xlarge
          // comment if deploying with ml.p4d or ml.p4e instances
          HF_MODEL_QUANTIZE: "bitsandbytes",
        },
      });

      this.suppressCdkNagWarningForEndpointRole(idefics80b.role);

      models.push({
        name: IDEFICS_80B_ENDPOINT_NAME!,
        endpoint: idefics80b.cfnEndpoint,
        responseStreamingSupported: false,
        inputModalities: [Modality.Text, Modality.Image],
        outputModalities: [Modality.Text],
        interface: ModelInterface.MultiModal,
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

    if (models.length > 0 && props.config.llms?.sagemakerSchedule?.enabled) {
      const schedulerRole: iam.Role = new iam.Role(this, "SchedulerRole", {
        assumedBy: new iam.ServicePrincipal("scheduler.amazonaws.com"),
        description: "Role for Scheduler to interact with SageMaker",
      });

      schedulerRole.addManagedPolicy(
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSageMakerFullAccess")
      );
      this.suppressCdkNagWarningForEndpointRole(schedulerRole);

      models.forEach((model) => {
        createStartSchedule(
          this,
          id,
          model.endpoint,
          schedulerRole,
          props.config
        );
        createStopSchedule(
          this,
          id,
          model.endpoint,
          schedulerRole,
          props.config
        );
      });
    }
  }

  private suppressCdkNagWarningForEndpointRole(role: iam.Role) {
    NagSuppressions.addResourceSuppressions(
      role,
      [
        {
          id: "AwsSolutions-IAM4",
          reason:
            "Gives user ability to deploy and delete endpoints from the UI.",
        },
        {
          id: "AwsSolutions-IAM5",
          reason:
            "Gives user ability to deploy and delete endpoints from the UI.",
        },
      ],
      true
    );
  }
}
