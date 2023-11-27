import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as servicecatalog from "aws-cdk-lib/aws-servicecatalog";
import { Construct } from "constructs";
import {
  ContainerImages,
  DeploymentType,
  SageMakerModel,
  SageMakerModelProduct,
} from "../sagemaker-model";
import { Shared } from "../shared";
import {
  Modality,
  ModelInterface,
  SystemConfig,
} from "../shared/types";
import { RagEngines } from "../rag-engines";
import { ChatBotApi } from "../chatbot-api";

export interface ModelsProps {
  readonly config: SystemConfig;
  readonly shared: Shared;
  readonly ragEngines?: RagEngines;
  readonly chatBotApi: ChatBotApi;
}

export class Models extends Construct {
  public readonly modelsParameterPath: string = "/chatbot/models/";
  public readonly portfolio: servicecatalog.Portfolio;

  constructor(scope: Construct, id: string, props: ModelsProps) {
    super(scope, id);
    const portfolioAssetBucket = new s3.Bucket(this, "PortfolioAssetBucket");

    const portfolio = new servicecatalog.Portfolio(this, "ModelsPortfolio", {
      displayName: "GenAI Chatbot SageMaker Models",
      providerName: "GenAI Chatbot",
      description:
        "Models that can be launched to be used with the GenAI Chatbot",
    });

    if (props.chatBotApi.apiHandler.role) {
      portfolio.giveAccessToRole(props.chatBotApi.apiHandler.role);
    }

    const defaultSecurityGroup = props.shared.vpc.vpcDefaultSecurityGroup;


    const falconLiteProduct = new servicecatalog.CloudFormationProduct(
      this,
      "FalconLiteProduct",
      {
        owner: "GenAI Chatbot",
        productName: "FalconLite",
        productVersions: [
          {
            cloudFormationTemplate:
              servicecatalog.CloudFormationTemplate.fromProductStack(
                new SageMakerModelProduct(this, "FalconLite", {
                  assetBucket: portfolioAssetBucket,
                  vpc: props.shared.vpc,
                  securityGroupId: defaultSecurityGroup,
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
                  responseStreamingSupported: false,
                  inputModalities: [Modality.Text],
                  outputModalities: [Modality.Text],
                  interface: ModelInterface.LangChain,
                  ragSupported: true,
                  apiHandler: props.chatBotApi.apiHandler,
                })
              ),
          },
        ],
      }
    );

    portfolio.addProduct(falconLiteProduct);



    const mistral7bInstructProduct = new servicecatalog.CloudFormationProduct(
      this,
      "Mistral7bInstructProduct",
      {
        owner: "GenAI Chatbot",
        productName: "Mistral7BInstruct",
        productVersions: [
          {
            cloudFormationTemplate:
              servicecatalog.CloudFormationTemplate.fromProductStack(
                new SageMakerModelProduct(
                  this,
                  "Mistral7BInstruct",
                  {
                    vpc: props.shared.vpc,
                    securityGroupId: defaultSecurityGroup,
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
                    responseStreamingSupported: false,
                    inputModalities: [Modality.Text],
                    outputModalities: [Modality.Text],
                    interface: ModelInterface.LangChain,
                    ragSupported: true,
                    apiHandler: props.chatBotApi.apiHandler,
                  }
                )
              ),
          },
        ],
      }
    );

    portfolio.addProduct(mistral7bInstructProduct);

    // To get Jumpstart model ARNs do the following
    // 1. Identify the modelId via https://sagemaker.readthedocs.io/en/stable/doc_utils/pretrainedmodels.html
    // 2. Run the following code
    //
    //      from sagemaker.jumpstart.model import JumpStartModel
    //      region = 'us-east-1'
    //      model_id = 'meta-textgeneration-llama-2-13b-f'
    //      model = JumpStartModel(model_id=model_id, region=region)
    //      print(model.model_package_arn)



    const llama2chatProduct = new servicecatalog.CloudFormationProduct(
      this,
      "LLamaV2_13B_ChatProduct",
      {
        owner: "GenAI Chatbot",
        productName: "LLamaV2_13B_Chat",
        productVersions: [
          {
            cloudFormationTemplate:
              servicecatalog.CloudFormationTemplate.fromProductStack(
                new SageMakerModelProduct(this, "LLamaV2_13B_Chat", {
                  assetBucket: portfolioAssetBucket,
                  vpc: props.shared.vpc,
                  securityGroupId: defaultSecurityGroup,
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
                  responseStreamingSupported: false,
                  inputModalities: [Modality.Text],
                  outputModalities: [Modality.Text],
                  interface: ModelInterface.LangChain,
                  ragSupported: true,
                  apiHandler: props.chatBotApi.apiHandler,
                })
              ),
          },
        ],
      }
    );

    portfolio.addProduct(llama2chatProduct);



    const idefics9bProduct = new servicecatalog.CloudFormationProduct(
      this,
      "IDEFICS9BProduct",
      {
        owner: "GenAI Chatbot",
        productName: "IDEFICS9B",
        productVersions: [
          {
            cloudFormationTemplate:
              servicecatalog.CloudFormationTemplate.fromProductStack(new SageMakerModelProduct(this, "IDEFICS9B", {
                assetBucket: portfolioAssetBucket,
                vpc: props.shared.vpc,
                securityGroupId: defaultSecurityGroup,
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
                responseStreamingSupported: false,
                inputModalities: [Modality.Text, Modality.Image],
                outputModalities: [Modality.Text],
                interface: ModelInterface.Idefics,
                ragSupported: false,
                apiHandler: props.chatBotApi.apiHandler,
              })),
          },
        ],
      }
    );

    portfolio.addProduct(idefics9bProduct);



    const idefics80bProduct = new servicecatalog.CloudFormationProduct(
      this,
      "IDEFICS80BProduct",
      {
        owner: "GenAI Chatbot",
        productName: "IDEFICS80B",
        productVersions: [
          {
            cloudFormationTemplate:
              servicecatalog.CloudFormationTemplate.fromProductStack(
                new SageMakerModelProduct(this, "IDEFICS80B", {
                  assetBucket: portfolioAssetBucket,
                  vpc: props.shared.vpc,
                  securityGroupId: defaultSecurityGroup,
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
                  responseStreamingSupported: false,
                  inputModalities: [Modality.Text, Modality.Image],
                  outputModalities: [Modality.Text],
                  interface: ModelInterface.Idefics,
                  ragSupported: false,
                  apiHandler: props.chatBotApi.apiHandler,
                })
              ),
          },
        ],
      }
    );

    portfolio.addProduct(idefics80bProduct);

    this.portfolio = portfolio;
  }
}
