#!/usr/bin/env node

// Copyright 2021 Amazon.com.
// SPDX-License-Identifier: MIT

import { Command } from "commander";
import * as enquirer from "enquirer";
import {
  SupportedRegion,
  SupportedSageMakerLLM,
  SystemConfig,
} from "../lib/shared/types";
import { LIB_VERSION } from "./version.js";
import * as fs from "fs";

const iamRoleRegExp = RegExp(/arn:aws:iam::\d+:role\/[\w-_]+/);
const kendraIdRegExp = RegExp(/^\w{8}-\w{4}-\w{4}-\w{4}-\w{12}$/);

const embeddingModels = [
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
];

/**
 * Main entry point
 */

(async () => {
  let program = new Command().description(
    "Creates a new chatbot configuration"
  );
  program.version(LIB_VERSION);

  program.option("-p, --prefix <prefix>", "The prefix for the stack");

  program.action(async (options) => {
    if (fs.existsSync("./bin/config.json")) {
      const config: SystemConfig = JSON.parse(
        fs.readFileSync("./bin/config.json").toString("utf8")
      );
      options.prefix = config.prefix;
      options.bedrockEnable = config.bedrock?.enabled;
      options.bedrockRegion = config.bedrock?.region;
      options.bedrockEndpoint = config.bedrock?.endpointUrl;
      options.bedrockRoleArn = config.bedrock?.roleArn;
      options.sagemakerLLMs = config.llms.sagemaker;
      options.enableRag = config.rag.enabled;
      options.ragsToEnable = Object.keys(config.rag.engines).filter(
        (v: string) => (config.rag.engines as any)[v].enabled
      );
      if (options.ragsToEnable.includes("kendra") && !config.rag.engines.kendra.createIndex) {
        options.ragsToEnable.pop("kendra")
      }
      options.embeddings = config.rag.embeddingsModels.map((m: any) => m.name);
      options.defaultEmbedding = config.rag.embeddingsModels.filter(
        (m: any) => m.default
      )[0].name;
      options.kendraExternal = config.rag.engines.kendra.external;
    }
    try {
      await processCreateOptions(options);
    } catch (err: any) {
      console.error("Could not complete the operation.");
      console.error(err.message);
      process.exit(1);
    }
  });

  program.parse(process.argv);
})();

function createConfig(config: any): void {
  fs.writeFileSync("./bin/config.json", JSON.stringify(config, undefined, 2));
  console.log("New config written to ./bin/config.json");
}

/**
 * Prompts the user for missing options
 *
 * @param options Options provided via the CLI
 * @returns The complete options
 */
async function processCreateOptions(options: any): Promise<void> {
  let questions = [
    {
      type: "input",
      name: "prefix",
      message: "Prefix to differentiate this deployment",
      initial: options.prefix,
      askAnswered: false,
    },
    {
      type: "confirm",
      name: "bedrockEnable",
      message: "Do you have access to Bedrock and want to enable it",
      initial: true,
    },
    {
      type: "select",
      name: "bedrockRegion",
      message: "Region where Bedrock is available",
      choices: [
        SupportedRegion.US_EAST_1,
        SupportedRegion.US_WEST_2,
        SupportedRegion.EU_CENTRAL_1,
        SupportedRegion.AP_SOUTHEAST_1,
      ],
      initial: options.bedrockRegion ?? "us-east-1",
      skip() {
        return !(this as any).state.answers.bedrockEnable;
      },
    },
    {
      type: "input",
      name: "bedrockEndpoint",
      message: "Bedrock endpoint - leave as is for standard endpoint",
      initial() {
        return `https://bedrock-runtime.${
          (this as any).state.answers.bedrockRegion
        }.amazonaws.com`;
      },
    },
    {
      type: "input",
      name: "bedrockRoleArn",
      message:
        "Cross account role arn to invoke Bedrock - leave empty if Bedrock is in same account",
      validate: (v: string) => {
        const valid = iamRoleRegExp.test(v);
        return v.length === 0 || valid;
      },
      initial: options.bedrockRoleArn || "",
    },
    {
      type: "multiselect",
      name: "sagemakerLLMs",
      message:
        "Which Sagemaker LLMs do you want to enable (enter for None, space to select)",
      choices: Object.values(SupportedSageMakerLLM),
      initial: options.sagemakerLLMs || [],
    },
    {
      type: "confirm",
      name: "enableRag",
      message: "Do you want to enable RAG",
      initial: options.enableRag || true,
    },
    {
      type: "multiselect",
      name: "ragsToEnable",
      message: "Which datastores do you want to enable for RAG",
      choices: [
        { message: "Aurora", name: "aurora" },
        { message: "OpenSearch", name: "opensearch" },
        { message: "Kendra (managed)", name: "kendra" },
      ],
      skip(): boolean {
        // workaround for https://github.com/enquirer/enquirer/issues/298
        (this as any).state._choices = (this as any).state.choices;
        return !(this as any).state.answers.enableRag;
      },
      initial: options.ragsToEnable || [],
    },
    {
      type: "confirm",
      name: "kendra",
      message: "Do you want to add existing Kendra indexes",
      initial:
        (options.kendraExternal !== undefined &&
          options.kendraExternal.length > 0) ||
        false,
      skip: function (): boolean {
        // workaround for https://github.com/enquirer/enquirer/issues/298
        (this as any).state._choices = (this as any).state.choices;
        return !(this as any).state.answers.enableRag;
      },
    },
  ];
  const answers: any = await enquirer.prompt(questions);
  const kendraExternal = [];
  let newKendra = answers.enableRag && answers.kendra;
  const existingKendraIndices = Array.from(options.kendraExternal);
  while (newKendra === true) {
    let existingIndex: any = existingKendraIndices.pop();
    console.log(existingIndex?.region, Object.values(SupportedRegion).indexOf(existingIndex?.region))
    const kendraQ = [
      {
        type: "input",
        name: "name",
        message: "Kendra source name",
        validate(v: string) {
            return RegExp(/^\w[\w-_]*\w$/).test(v)
        },
        initial: existingIndex?.name,
      },
      {
        type: "autocomplete",
        limit: 8,
        name: "region",
        choices: Object.values(SupportedRegion),
        message: `Region of the Kendra index${existingIndex?.region ? " ("+existingIndex?.region+")" : ""}`,
        initial: Object.values(SupportedRegion).indexOf(existingIndex?.region),
      },
      {
        type: "input",
        name: "roleArn",
        message:
          "Cross account role Arn to assume to call Kendra, leave empty if not needed",
        validate: (v: string) => {
          const valid = iamRoleRegExp.test(v);
          return v.length === 0 || valid;
        },
        initial: existingIndex?.roleArn ?? "",
      },
      {
        type: "input",
        name: "kendraId",
        message: "Kendra ID",
        validate(v: string) {
          return kendraIdRegExp.test(v);
        },
        initial: existingIndex?.kendraId,
      },
      {
        type: "confirm",
        name: "enabled",
        message: "Enable this index",
        initial: existingIndex?.enabled ?? true,
      },
      {
        type: "confirm",
        name: "newKendra",
        message: "Do you want to add another Kendra source",
        initial: false,
      },
    ];
    const kendraInstance: any = await enquirer.prompt(kendraQ);
    const ext = (({ enabled, name, roleArn, kendraId, region }) => ({
      enabled, 
      name,
      roleArn,
      kendraId,
      region,
    }))(kendraInstance);
    if (ext.roleArn === "") ext.roleArn = undefined;
    kendraExternal.push({
      ...ext,
    });
    newKendra = kendraInstance.newKendra;
  }
  const modelsPrompts = [
    {
      type: "select",
      name: "defaultEmbedding",
      message: "Which is the default embedding model",
      choices: embeddingModels.map((m) => ({ name: m.name, value: m })),
      initial: options.defaultEmbedding || undefined,
      skip(): boolean {
        return !(this as any).state.answers.enableRag
      }
    },
  ];
  const models: any = await enquirer.prompt(modelsPrompts);

  // Create the config object
  const config = {
    prefix: answers.prefix,
    bedrock: answers.bedrockEnable
      ? {
          enabled: answers.bedrockEnable,
          region: answers.bedrockRegion,
          roleArn:
            answers.bedrockRoleArn === "" ? undefined : answers.bedrockRoleArn,
          endpointUrl: answers.bedrockEndpoint,
        }
      : undefined,
    llms: {
      sagemaker: answers.sagemakerLLMs,
    },
    rag: {
      enabled: answers.enableRag,
      engines: {
        aurora: {
          enabled: answers.ragsToEnable.includes("aurora"),
        },
        opensearch: {
          enabled: answers.ragsToEnable.includes("opensearch"),
        },
        kendra: {
          enabled: false,
          createIndex: false,
          external: [{}],
        },
      },
      embeddingsModels: [{}],
      crossEncoderModels: [
        {}
      ],
    },
  };
  
  // If we have not enabled rag the default embedding is set to the first model
  if (!answers.enableRag) {
    models.defaultEmbedding = embeddingModels[0].name;
  }

  config.rag.crossEncoderModels[0] = {
      provider: "sagemaker",
      name: "cross-encoder/ms-marco-MiniLM-L-12-v2",
      default: true,
    }
  config.rag.embeddingsModels = embeddingModels;
  config.rag.embeddingsModels.forEach((m: any) => {
    if (m.name === models.defaultEmbedding) {
      m.default = true;
    }
    });
  
  config.rag.engines.kendra.createIndex = answers.ragsToEnable.includes("kendra");
  config.rag.engines.kendra.enabled = config.rag.engines.kendra.createIndex || kendraExternal.length > 0;
  config.rag.engines.kendra.external = [...kendraExternal];

  console.log("\n✨ This is the chosen configuration:\n");
  console.log(JSON.stringify(config, undefined, 2));
  (
    (await enquirer.prompt([
      {
        type: "confirm",
        name: "create",
        message: "Do you want to create a new config based on the above",
        initial: false,
      },
    ])) as any
  ).create
    ? createConfig(config)
    : console.log("Skipping");
}
