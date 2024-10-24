import {
  SupportedRegion,
  SupportedSageMakerModels,
  SystemConfig,
} from "../../lib/shared/types";

export function getTestConfig(): SystemConfig {
  // Default config
  return {
    prefix: "prefix",
    privateWebsite: true,
    certificate: "",
    cfGeoRestrictEnable: true,
    cfGeoRestrictList: [],
    bedrock: {
      enabled: true,
      region: SupportedRegion.US_EAST_1,
    },
    llms: {
      sagemaker: [
        SupportedSageMakerModels.FalconLite,
        SupportedSageMakerModels.Idefics_80b,
      ],
    },
    rag: {
      crossEncodingEnabled: true,
      enabled: true,
      engines: {
        aurora: {
          enabled: true,
        },
        opensearch: {
          enabled: true,
        },
        kendra: {
          enabled: true,
          createIndex: true,
          enterprise: true,
        },
        knowledgeBase: {
          enabled: false,
        },
      },
      embeddingsModels: [
        {
          provider: "sagemaker",
          name: "intfloat/multilingual-e5-large",
          dimensions: 1024,
        },
        {
          provider: "sagemaker",
          name: "sentence-transformers/all-MiniLM-L6-v2",
          dimensions: 384,
        },
        {
          provider: "bedrock",
          name: "amazon.titan-embed-text-v1",
          dimensions: 1536,
        },
        //Support for inputImage is not yet implemented for amazon.titan-embed-image-v1
        {
          provider: "bedrock",
          name: "amazon.titan-embed-image-v1",
          dimensions: 1024,
        },
        {
          provider: "bedrock",
          name: "cohere.embed-english-v3",
          dimensions: 1024,
        },
        {
          provider: "bedrock",
          name: "cohere.embed-multilingual-v3",
          dimensions: 1024,
          default: true,
        },
        {
          provider: "openai",
          name: "text-embedding-ada-002",
          dimensions: 1536,
        },
      ],
      crossEncoderModels: [
        {
          provider: "sagemaker",
          name: "cross-encoder/ms-marco-MiniLM-L-12-v2",
          default: true,
        },
      ],
    },
  };
}
