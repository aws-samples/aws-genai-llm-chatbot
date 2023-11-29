import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as servicecatalog from "aws-cdk-lib/aws-servicecatalog";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import {
  ContainerImages,
  DeploymentType,
  SageMakerModelProduct,
} from "../sagemaker-model";
import { Shared } from "../shared";
import { Modality, ModelInterface, SystemConfig } from "../shared/types";
import { RagEngines } from "../rag-engines";
import { ChatBotApi } from "../chatbot-api";

export interface ModelsProps {
  readonly config: SystemConfig;
  readonly shared: Shared;
  readonly ragEngines?: RagEngines;
  readonly chatBotApi: ChatBotApi;
}

export class Models extends Construct {
  public readonly portfolio: servicecatalog.Portfolio;

  constructor(scope: Construct, id: string, props: ModelsProps) {
    super(scope, id);
    const portfolioAssetBucket = new s3.Bucket(this, "PortfolioAssetBucket");
    const productOwner = `${props.config.prefix}GenAIChatBotStack`;
    const defaultSecurityGroup = props.shared.vpc.vpcDefaultSecurityGroup;
    const falconLiteModelId = "amazon/FalconLite";
    const falconLiteProduct = new servicecatalog.CloudFormationProduct(
      scope,
      "FalconLiteProduct",
      {
        owner: productOwner,
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
                    modelId: falconLiteModelId,
                    container:
                      ContainerImages.HF_PYTORCH_LLM_TGI_INFERENCE_0_9_3,
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
                })
              ),
          },
        ],
      }
    );

    new ssm.StringParameter(this, "FalconLiteProductParams", {
      parameterName: `/${productOwner}/products/${falconLiteProduct.productId}`,
      simpleName: false,
      stringValue: JSON.stringify({
        provider: "sagemaker",
        name: falconLiteModelId.split("/").join("-").split(".").join("-"),
        modelId: falconLiteModelId,
        streaming: false,
        inputModalities: [Modality.Text],
        outputModalities: [Modality.Text],
        interface: ModelInterface.LangChain,
        ragSupported: true,
        productId: falconLiteProduct.productId,
      }),
    });

    const mistral7bInstructModelId = "mistralai/Mistral-7B-Instruct-v0.1";
    const mistral7bInstructProduct = new servicecatalog.CloudFormationProduct(
      this,
      "Mistral7bInstructProduct",
      {
        owner: productOwner,
        productName: "Mistral7BInstruct",
        productVersions: [
          {
            cloudFormationTemplate:
              servicecatalog.CloudFormationTemplate.fromProductStack(
                new SageMakerModelProduct(this, "Mistral7BInstruct", {
                  assetBucket: portfolioAssetBucket,
                  vpc: props.shared.vpc,
                  securityGroupId: defaultSecurityGroup,
                  region: cdk.Aws.REGION,
                  model: {
                    type: DeploymentType.Container,
                    modelId: mistral7bInstructModelId,
                    container:
                      ContainerImages.HF_PYTORCH_LLM_TGI_INFERENCE_1_1_0,
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
                })
              ),
          },
        ],
      }
    );

    new ssm.StringParameter(this, "mistral7bInstructProductParams", {
      parameterName: `/${productOwner}/products/${mistral7bInstructProduct.productId}`,
      simpleName: false,
      stringValue: JSON.stringify({
        provider: "sagemaker",
        name: mistral7bInstructModelId
          .split("/")
          .join("-")
          .split(".")
          .join("-"),
        modelId: mistral7bInstructModelId,
        streaming: false,
        inputModalities: [Modality.Text],
        outputModalities: [Modality.Text],
        interface: ModelInterface.LangChain,
        ragSupported: true,
        productId: mistral7bInstructProduct.productId,
      }),
    });

    const llama2chatModelId = "meta-LLama2-13b-chat";
    const llama2chatProduct = new servicecatalog.CloudFormationProduct(
      this,
      "LLamaV2_13B_ChatProduct",
      {
        owner: productOwner,
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
                    modelId: llama2chatModelId,
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
                })
              ),
          },
        ],
      }
    );

    new ssm.StringParameter(this, "LLamaV2_13B_ChatProductParams", {
      parameterName: `/${productOwner}/products/${llama2chatProduct.productId}`,
      simpleName: false,
      stringValue: JSON.stringify({
        provider: "sagemaker",
        name: llama2chatModelId.split("/").join("-").split(".").join("-"),
        modelId: llama2chatModelId,
        streaming: false,
        inputModalities: [Modality.Text],
        outputModalities: [Modality.Text],
        interface: ModelInterface.LangChain,
        ragSupported: true,
        productId: llama2chatProduct.productId,
      }),
    });

    const idefics9bModelId = "HuggingFaceM4/idefics-9b-instruct";
    const idefics9bProduct = new servicecatalog.CloudFormationProduct(
      this,
      "IDEFICS9BProduct",
      {
        owner: productOwner,
        productName: "IDEFICS9B",
        productVersions: [
          {
            cloudFormationTemplate:
              servicecatalog.CloudFormationTemplate.fromProductStack(
                new SageMakerModelProduct(this, "IDEFICS9B", {
                  assetBucket: portfolioAssetBucket,
                  vpc: props.shared.vpc,
                  securityGroupId: defaultSecurityGroup,
                  region: cdk.Aws.REGION,
                  model: {
                    type: DeploymentType.Container,
                    modelId: idefics9bModelId,
                    container:
                      ContainerImages.HF_PYTORCH_LLM_TGI_INFERENCE_1_1_0,
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
                })
              ),
          },
        ],
      }
    );

    new ssm.StringParameter(this, "IDEFICS9BProductParams", {
      parameterName: `/${productOwner}/products/${idefics9bProduct.productId}`,
      simpleName: false,
      stringValue: JSON.stringify({
        provider: "sagemaker",
        name: idefics9bModelId.split("/").join("-").split(".").join("-"),
        modelId: idefics9bModelId,
        streaming: false,
        inputModalities: [Modality.Text, Modality.Image],
        outputModalities: [Modality.Text],
        interface: ModelInterface.Idefics,
        ragSupported: false,
        productId: idefics9bProduct.productId,
      }),
    });

    const idefics80bModelId = "HuggingFaceM4/idefics-80b-instruct";
    const idefics80bProduct = new servicecatalog.CloudFormationProduct(
      this,
      "IDEFICS80BProduct",
      {
        owner: productOwner,
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
                    modelId: idefics80bModelId,
                    container:
                      ContainerImages.HF_PYTORCH_LLM_TGI_INFERENCE_1_1_0,
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
                })
              ),
          },
        ],
      }
    );

    new ssm.StringParameter(this, "IDEFICS80BProductParams", {
      parameterName: `/${productOwner}/products/${idefics80bProduct.productId}`,
      simpleName: false,
      stringValue: JSON.stringify({
        provider: "sagemaker",
        modelId: idefics80bModelId,
        streaming: false,
        inputModalities: [Modality.Text, Modality.Image],
        outputModalities: [Modality.Text],
        interface: ModelInterface.Idefics,
        ragSupported: false,
        productId: idefics80bProduct.productId,
      }),
    });

    //Add all the declared products to a portfolio.
    const portfolio = new servicecatalog.Portfolio(this, "ModelsPortfolio", {
      displayName: "GenAI Chatbot SageMaker Models",
      providerName: productOwner,
      description:
        "Models that can be launched to be used with the GenAI Chatbot",
    });

    new ssm.StringParameter(this, "ProductsConfig", {
      parameterName: `/${productOwner}/products-config`,
      stringValue: JSON.stringify({
        vpcId: props.shared.vpc.vpcId,
        defaultSecurityGroupId: defaultSecurityGroup,
        privateSubnets: props.shared.vpc.privateSubnets.map(
          (subnet) => subnet.subnetId
        ),
        restApiIamRole: props.chatBotApi.apiHandler.role?.roleArn,
        productOwner: productOwner,
      }),
    });

    if (props.chatBotApi.apiHandler.role) {
      portfolio.giveAccessToRole(props.chatBotApi.apiHandler.role);
      props.chatBotApi.apiHandler.role.addToPrincipalPolicy(
        new iam.PolicyStatement({
          actions: ["servicecatalog:SearchProducts"],
          resources: ["*"],
          effect: iam.Effect.ALLOW,
        })
      );
    }
    portfolio.addProduct(falconLiteProduct);
    portfolio.addProduct(mistral7bInstructProduct);
    portfolio.addProduct(idefics80bProduct);
    portfolio.addProduct(llama2chatProduct);
    portfolio.addProduct(idefics9bProduct);
    this.portfolio = portfolio;

    // To get Jumpstart model ARNs do the following
    // 1. Identify the modelId via https://sagemaker.readthedocs.io/en/stable/doc_utils/pretrainedmodels.html
    // 2. Run the following code
    //
    //      from sagemaker.jumpstart.model import JumpStartModel
    //      region = 'us-east-1'
    //      model_id = 'meta-textgeneration-llama-2-13b-f'
    //      model = JumpStartModel(model_id=model_id, region=region)
    //      print(model.model_package_arn)
  }
}
