import { SupportedRegion, SystemConfig } from "../lib/shared/types";
import { existsSync, readFileSync } from "fs";

export function getConfig(): SystemConfig {
  if (existsSync("./bin/config.json")) {
    return JSON.parse(readFileSync("./bin/config.json").toString("utf8"));
  }
  // Default config
  return {
    prefix: "",
    /*vpc: {
      vpcId: "vpc-00000000000000000",
      createVpcEndpoints: true,
    },*/
    bedrock: {
      enabled: true,
      region: SupportedRegion.US_EAST_1,
    },
    llms: {
      // sagemaker: [SupportedSageMakerModels.FalconLite]
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

export const config: SystemConfig = getConfig();
