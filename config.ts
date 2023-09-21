import { SupportedRegion, SystemConfig } from "./lib/shared/types";

export const config: SystemConfig = {
  prefix: "",
  bedrock: {
    enabled: true,
  },
  llms: [],
  rag: {
    enabled: true,
    engines: {
      aurora: {
        enabled: true,
      },
      opensearch: {
        enabled: true,
      },
      kendra: {
        enabled: false,
      },
    },
    embeddingsModels: [
      {
        provider: "sagemaker",
        name: "intfloat/multilingual-e5-large",
        default: true,
        dimensions: 1024,
      },
      {
        provider: "sagemaker",
        name: "sentence-transformers/all-MiniLM-L6-v2",
        dimensions: 384,
      },
      {
        provider: "bedrock",
        name: "amazon.titan-e1t-medium",
        dimensions: 4096,
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
