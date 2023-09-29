import {
  SupportedRegion,
  SupportedSageMakerLLM,
  SystemConfig,
} from "../lib/shared/types";
import { existsSync, readFileSync } from "fs";

export function getConfig(): SystemConfig {
  if (existsSync("./bin/config.json")) {
    return JSON.parse(readFileSync("./bin/config.json").toString("utf8"));
  }
  // Default config
  return {
    prefix: "",
    bedrock: {
      enabled: true,
      region: SupportedRegion.US_EAST_1,
      endpointUrl: "https://bedrock-runtime.us-east-1.amazonaws.com",
    },
    llms: {
      // sagemaker: [SupportedSageMakerLLM.FalconLite]
      sagemaker: [],
    },
    rag: {
      enabled: false,
      engines: {
        aurora: {
          enabled: false,
        },
        opensearch: {
          enabled: false,
        },
        kendra: {
          enabled: false,
          createIndex: false,
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
          provider: "bedrock",
          name: "amazon.titan-embed-text-v1",
          dimensions: 1536,
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

export const config: SystemConfig = getConfig();
