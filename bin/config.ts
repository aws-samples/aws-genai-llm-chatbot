import { SupportedRegion, SystemConfig } from "../lib/shared/types";
import { existsSync, readFileSync } from "fs";

export function getConfig(): SystemConfig {
  if (existsSync("./bin/config.json")) {
    return JSON.parse(
      readFileSync("./bin/config.json").toString("utf8")
    ) as SystemConfig;
  }
  // Default config
  return {
    prefix: "",
    /* vpc: {
       vpcId: "vpc-00000000000000000",
       createVpcEndpoints: true,
       vpcDefaultSecurityGroup: "sg-00000000000"
    },*/
    privateWebsite: false,
    certificate: "",
    cfGeoRestrictEnable: false,
    cfGeoRestrictList: [],
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
          enterprise: false,
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
          default: false,
        },
        {
          provider: "sagemaker",
          name: "sentence-transformers/all-MiniLM-L6-v2",
          dimensions: 384,
          default: false,
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
          default: false,
        },
      ],
      crossEncodingEnabled: false,
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
