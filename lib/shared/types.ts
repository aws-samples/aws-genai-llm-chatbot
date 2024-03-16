import * as sagemaker from "aws-cdk-lib/aws-sagemaker";

export type ModelProvider = "sagemaker" | "bedrock" | "openai";

export enum SupportedSageMakerModels {
  FalconLite = "FalconLite [ml.g5.12xlarge]",
  Llama2_13b_Chat = "Llama2_13b_Chat [ml.g5.12xlarge]",
  Mistral7b_Instruct = "Mistral7b_Instruct 0.1 [ml.g5.2xlarge]",
  Mistral7b_Instruct2 = "Mistral7b_Instruct 0.2 [ml.g5.2xlarge]",
  Mixtral_8x7b_Instruct = "Mixtral_8x7B_Instruct 0.1 [ml.g5.48xlarge]",
  Idefics_9b = "Idefics_9b (Multimodal) [ml.g5.12xlarge]",
  Idefics_80b = "Idefics_80b (Multimodal) [ml.g5.48xlarge]",
}

export enum SupportedRegion {
  AF_SOUTH_1 = "af-south-1",
  AP_EAST_1 = "ap-east-1",
  AP_NORTHEAST_1 = "ap-northeast-1",
  AP_NORTHEAST_2 = "ap-northeast-2",
  AP_NORTHEAST_3 = "ap-northeast-3",
  AP_SOUTH_1 = "ap-south-1",
  AP_SOUTH_2 = "ap-south-2",
  AP_SOUTHEAST_1 = "ap-southeast-1",
  AP_SOUTHEAST_2 = "ap-southeast-2",
  AP_SOUTHEAST_3 = "ap-southeast-3",
  AP_SOUTHEAST_4 = "ap-southeast-4",
  CA_CENTRAL_1 = "ca-central-1",
  EU_CENTRAL_1 = "eu-central-1",
  EU_CENTRAL_2 = "eu-central-2",
  EU_NORTH_1 = "eu-north-1",
  EU_SOUTH_1 = "eu-south-1",
  EU_SOUTH_2 = "eu-south-2",
  EU_WEST_1 = "eu-west-1",
  EU_WEST_2 = "eu-west-2",
  EU_WEST_3 = "eu-west-3",
  IL_CENTRAL_1 = "il-central-1",
  ME_CENTRAL_1 = "me-central-1",
  ME_SOUTH_1 = "me-south-1",
  SA_EAST_1 = "sa-east-1",
  US_EAST_1 = "us-east-1",
  US_EAST_2 = "us-east-2",
  US_WEST_1 = "us-west-1",
  US_WEST_2 = "us-west-2",
}

export enum SupportedBedrockRegion {
  AP_NORTHEAST_1 = "ap-northeast-1",
  AP_SOUTHEAST_1 = "ap-southeast-1",
  EU_CENTRAL_1 = "eu-central-1",
  US_EAST_1 = "us-east-1",
  US_WEST_2 = "us-west-2",
}

export enum ModelInterface {
  LangChain = "langchain",
  MultiModal = "multimodal",
}

export enum Modality {
  Text = "TEXT",
  Image = "IMAGE",
  Embedding = "EMBEDDING",
}

export enum Direction {
  In = "IN",
  Out = "OUT",
}

export interface SystemConfig {
  prefix: string;
  vpc?: {
    vpcId?: string;
    createVpcEndpoints?: boolean;
  };
  certificate?: string;
  domain?: string;
  privateWebsite?: boolean;
  cfGeoRestrictEnable: boolean;
  cfGeoRestrictList: [];
  bedrock?: {
    enabled?: boolean;
    region?: SupportedRegion;
    endpointUrl?: string;
    roleArn?: string;
  };
  llms: {
    sagemaker: SupportedSageMakerModels[];
    sagemakerSchedule?: {
      enabled?: boolean;
      timezonePicker?: string;
      enableCronFormat?: boolean;
      sagemakerCronStartSchedule?: string;
      sagemakerCronStopSchedule?: string;
      daysForSchedule?: string;
      scheduleStartTime?: string;
      scheduleStopTime?: string;
      enableScheduleEndDate?: boolean;
      startScheduleEndDate?: string;
    };
  };
  rag: {
    enabled: boolean;
    engines: {
      aurora: {
        enabled: boolean;
      };
      opensearch: {
        enabled: boolean;
      };
      kendra: {
        enabled: boolean;
        createIndex: boolean;
        external?: {
          name: string;
          kendraId: string;
          region?: SupportedRegion;
          roleArn?: string;
        }[];
        enterprise?: boolean;
      };
    };
    embeddingsModels: {
      provider: ModelProvider;
      name: string;
      dimensions: number;
      default?: boolean;
    }[];
    crossEncoderModels: {
      provider: ModelProvider;
      name: string;
      default?: boolean;
    }[];
  };
}

export interface SageMakerLLMEndpoint {
  name: string;
  endpoint: sagemaker.CfnEndpoint;
}

export interface SageMakerModelEndpoint {
  name: string;
  endpoint: sagemaker.CfnEndpoint;
  responseStreamingSupported: boolean;
  inputModalities: Modality[];
  outputModalities: Modality[];
  interface: ModelInterface;
  ragSupported: boolean;
}
