#!/usr/bin/env node

// Copyright 2021 Amazon.com.
// SPDX-License-Identifier: MIT

import { Command } from "commander";
import * as enquirer from "enquirer";
import {
  SupportedRegion,
  SupportedSageMakerModels,
  SystemConfig,
  SupportedBedrockRegion,
  ModelConfig,
} from "../lib/shared/types";
import { LIB_VERSION } from "./version.js";
import * as fs from "fs";
import { AWSCronValidator } from "./aws-cron-validator";
import { tz } from "moment-timezone";
import { getData } from "country-list";
import { randomBytes } from "crypto";
import { StringUtils } from "turbocommons-ts";

/* eslint-disable @typescript-eslint/no-explicit-any */

function getTimeZonesWithCurrentTime(): { message: string; name: string }[] {
  const timeZones = tz.names(); // Get a list of all timezones
  const timeZoneData = timeZones.map((zone) => {
    // Get current time in each timezone
    const currentTime = tz(zone).format("YYYY-MM-DD HH:mm");
    return { message: `${zone}: ${currentTime}`, name: zone };
  });
  return timeZoneData;
}

function getCountryCodesAndNames(): { message: string; name: string }[] {
  // Use country-list to get an array of countries with their codes and names
  const countries = getData();
  // Map the country data to match the desired output structure
  const countryInfo = countries.map(({ code, name }) => {
    return { message: `${name} (${code})`, name: code };
  });
  return countryInfo;
}

function isValidDate(dateString: string): boolean {
  // Check the pattern YYYY-MM-DD
  const regex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;
  if (!regex.test(dateString)) {
    return false;
  }

  // Parse the date parts to integers
  const parts = dateString.split("-");
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
  const day = parseInt(parts[2], 10);

  // Check the date validity
  const date = new Date(year, month, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return false;
  }

  // Check if the date is in the future compared to the current date at 00:00:00
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date <= today) {
    return false;
  }

  return true;
}

const timeZoneData = getTimeZonesWithCurrentTime();
const cfCountries = getCountryCodesAndNames();

const iamRoleRegExp = RegExp(/arn:aws:iam::\d+:role\/[\w-_]+/);
const acmCertRegExp = RegExp(/arn:aws:acm:[\w-_]+:\d+:certificate\/[\w-_]+/);
const cfAcmCertRegExp = RegExp(
  /arn:aws:acm:us-east-1:\d+:certificate\/[\w-_]+/
);
const kendraIdRegExp = RegExp(/^\w{8}-\w{4}-\w{4}-\w{4}-\w{12}$/);
const secretManagerArnRegExp = RegExp(
  /arn:aws:secretsmanager:[\w-_]+:\d+:secret:[\w-_]+/
);

const embeddingModels: ModelConfig[] = [
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
    default: false,
  },
  //Support for inputImage is not yet implemented for amazon.titan-embed-image-v1
  {
    provider: "bedrock",
    name: "amazon.titan-embed-image-v1",
    dimensions: 1024,
    default: false,
  },
  {
    provider: "bedrock",
    name: "cohere.embed-english-v3",
    dimensions: 1024,
    default: false,
  },
  {
    provider: "bedrock",
    name: "cohere.embed-multilingual-v3",
    dimensions: 1024,
    default: false,
  },
  {
    provider: "openai",
    name: "text-embedding-ada-002",
    dimensions: 1536,
    default: false,
  },
];

/**
 * Main entry point
 */

(async () => {
  const program = new Command().description(
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
      options.createCMKs = config.createCMKs;
      options.retainOnDelete = config.retainOnDelete;
      options.ddbDeletionProtection = config.ddbDeletionProtection;
      options.vpcId = config.vpc?.vpcId;
      options.bedrockEnable = config.bedrock?.enabled;
      options.bedrockRegion = config.bedrock?.region;
      options.bedrockRoleArn = config.bedrock?.roleArn;
      options.guardrailsEnable = config.bedrock?.guardrails?.enabled;
      options.guardrails = config.bedrock?.guardrails;
      options.sagemakerModels = config.llms?.sagemaker ?? [];
      options.enableSagemakerModels = config.llms?.sagemaker
        ? config.llms?.sagemaker.length > 0
        : false;
      options.huggingfaceApiSecretArn = config.llms?.huggingfaceApiSecretArn;
      options.enableSagemakerModelsSchedule =
        config.llms?.sagemakerSchedule?.enabled;
      options.enableSagemakerModelsSchedule =
        config.llms?.sagemakerSchedule?.enabled;
      options.timezonePicker = config.llms?.sagemakerSchedule?.timezonePicker;
      options.enableCronFormat =
        config.llms?.sagemakerSchedule?.enableCronFormat;
      options.cronSagemakerModelsScheduleStart =
        config.llms?.sagemakerSchedule?.sagemakerCronStartSchedule;
      options.cronSagemakerModelsScheduleStop =
        config.llms?.sagemakerSchedule?.sagemakerCronStopSchedule;
      options.daysForSchedule = config.llms?.sagemakerSchedule?.daysForSchedule;
      options.scheduleStartTime =
        config.llms?.sagemakerSchedule?.scheduleStartTime;
      options.scheduleStopTime =
        config.llms?.sagemakerSchedule?.scheduleStopTime;
      options.enableScheduleEndDate =
        config.llms?.sagemakerSchedule?.enableScheduleEndDate;
      options.startScheduleEndDate =
        config.llms?.sagemakerSchedule?.startScheduleEndDate;
      options.enableRag = config.rag.enabled;
      options.deployDefaultSagemakerModels =
        config.rag.deployDefaultSagemakerModels;
      options.ragsToEnable = Object.keys(config.rag.engines ?? {}).filter(
        (v: string) =>
          (
            config.rag.engines as {
              [key: string]: { enabled: boolean };
            }
          )[v].enabled
      );
      if (
        options.ragsToEnable.includes("kendra") &&
        !config.rag.engines.kendra.createIndex
      ) {
        options.ragsToEnable.pop("kendra");
      }
      options.embeddings = config.rag.embeddingsModels.map((m) => m.name);
      const defaultEmbeddings = (config.rag.embeddingsModels ?? []).filter(
        (m) => m.default
      );

      if (defaultEmbeddings.length > 0) {
        options.defaultEmbedding = defaultEmbeddings[0].name;
      }

      options.kendraExternal = config.rag.engines.kendra.external;
      options.kbExternal = config.rag.engines.knowledgeBase?.external ?? [];
      options.kendraEnterprise = config.rag.engines.kendra.enterprise;

      // Advanced settings

      options.advancedMonitoring = config.advancedMonitoring;
      options.createVpcEndpoints = config.vpc?.createVpcEndpoints;
      options.logRetention = config.logRetention;
      options.rateLimitPerAIP = config.rateLimitPerIP;
      options.llmRateLimitPerIP = config.llms.rateLimitPerIP;
      options.privateWebsite = config.privateWebsite;
      options.certificate = config.certificate;
      options.domain = config.domain;
      options.cognitoFederationEnabled = config.cognitoFederation?.enabled;
      options.cognitoCustomProviderName =
        config.cognitoFederation?.customProviderName;
      options.cognitoCustomProviderType =
        config.cognitoFederation?.customProviderType;
      options.cognitoCustomProviderSAMLMetadata =
        config.cognitoFederation?.customSAML?.metadataDocumentUrl;
      options.cognitoCustomProviderOIDCClient =
        config.cognitoFederation?.customOIDC?.OIDCClient;
      options.cognitoCustomProviderOIDCSecret =
        config.cognitoFederation?.customOIDC?.OIDCSecret;
      options.cognitoCustomProviderOIDCIssuerURL =
        config.cognitoFederation?.customOIDC?.OIDCIssuerURL;
      options.cognitoAutoRedirect = config.cognitoFederation?.autoRedirect;
      options.cognitoDomain = config.cognitoFederation?.cognitoDomain;
      options.cfGeoRestrictEnable = config.cfGeoRestrictEnable;
      options.cfGeoRestrictList = config.cfGeoRestrictList;
    }
    try {
      await processCreateOptions(options);
    } catch (err) {
      console.error("Could not complete the operation.");
      if (err instanceof Error) {
        console.error(err.message);
      }
      process.exit(1);
    }
  });

  program.parse(process.argv);
})();

function createConfig(config: any): void {
  fs.writeFileSync("./bin/config.json", JSON.stringify(config, undefined, 2));
  console.log("Configuration written to ./bin/config.json");
}

/**
 * Prompts the user for missing options
 *
 * @param options Options provided via the CLI
 * @returns The complete options
 */
async function processCreateOptions(options: any): Promise<void> {
  const questions = [
    {
      type: "input",
      name: "prefix",
      message: "Prefix to differentiate this deployment",
      initial: options.prefix,
      askAnswered: false,
      validate(value: string) {
        const regex = /^[a-zA-Z0-9-]{0,10}$/;
        return regex.test(value)
          ? true
          : "Only letters, numbers, and dashes are allowed. The max length is 10 characters.";
      },
    },
    {
      type: "confirm",
      name: "existingVpc",
      message:
        "Do you want to use existing vpc? (selecting false will create a new vpc)",
      initial: options.vpcId ? true : false,
    },
    {
      type: "input",
      name: "vpcId",
      message: "Specify existing VpcId (vpc-xxxxxxxxxxxxxxxxx)",
      initial: options.vpcId,
      validate(vpcId: string) {
        return (this as any).skipped ||
          RegExp(/^vpc-[0-9a-f]{8,17}$/i).test(vpcId)
          ? true
          : "Enter a valid VpcId in vpc-xxxxxxxxxxx format";
      },
      skip(): boolean {
        return !(this as any).state.answers.existingVpc;
      },
    },
    {
      type: "confirm",
      name: "createCMKs",
      message:
        "Do you want to create KMS Customer Managed Keys (CMKs)? (It will be used to encrypt the data at rest.)",
      initial: options.createCMKs ?? true,
      hint: "It is recommended but enabling it on an existing environment will cause the re-creation of some of the resources (for example Aurora cluster, Open Search collection). To prevent data loss, it is recommended to use it on a new environment or at least enable retain on cleanup (needs to be deployed before enabling the use of CMK). For more information on Aurora migration, please refer to the documentation.",
    },
    {
      type: "confirm",
      name: "retainOnDelete",
      message:
        "Do you want to retain data stores on cleanup of the project (Logs, S3, Tables, Indexes, Cognito User pools)?",
      initial: options.retainOnDelete ?? true,
      hint: "It reduces the risk of deleting data. It will however not delete all the resources on cleanup (would require manual removal if relevant)",
    },
    {
      type: "confirm",
      name: "ddbDeletionProtection",
      message:
        "Do you want to enable delete protection for your DynamoDB tables?",
      initial: options.ddbDeletionProtection ?? false,
      hint: "It reduces the risk of accidental deleting your DDB tables. It will however not delete your DDB tables on cleanup.",
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
      choices: Object.values(SupportedBedrockRegion),
      initial: options.bedrockRegion ?? "us-east-1",
      skip() {
        return !(this as any).state.answers.bedrockEnable;
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
      initial: options.bedrockRoleArn ?? "",
      skip() {
        return !(this as any).state.answers.bedrockEnable;
      },
    },
    {
      type: "confirm",
      name: "guardrailsEnable",
      message:
        "Do you want to enable Bedrock Guardrails? This is a recommended feature to build responsible AI applications." +
        " (Supported by all models except Idefics via SageMaker. If enabled, streaming will only work with Bedrock)",
      initial: options.guardrailsEnable ?? false,
    },
    {
      type: "input",
      name: "guardrailsIdentifier",
      message: "Bedrock Guardrail Identifier",
      validate(v: string) {
        return (this as any).skipped || (v && v.length === 12);
      },
      skip() {
        return !(this as any).state.answers.guardrailsEnable;
      },
      initial: options.guardrails?.identifier ?? "",
    },
    {
      type: "input",
      name: "guardrailsVersion",
      message: "Bedrock Guardrail Version",
      skip() {
        return !(this as any).state.answers.guardrailsEnable;
      },
      initial: options.guardrails?.version ?? "DRAFT",
    },
    {
      type: "confirm",
      name: "enableSagemakerModels",
      message: "Do you want to use any text generation SageMaker Models",
      initial: options.enableSagemakerModels || false,
    },
    {
      type: "multiselect",
      name: "sagemakerModels",
      hint: "SPACE to select, ENTER to confirm selection [denotes instance size to host model]",
      message: "Which SageMaker Models do you want to enable",
      choices: Object.values(SupportedSageMakerModels),
      initial:
        (options.sagemakerModels ?? []).filter((m: string) =>
          Object.values(SupportedSageMakerModels)
            .map((x) => x.toString())
            .includes(m)
        ) || [],
      validate(choices: any) {
        return (this as any).skipped || choices.length > 0
          ? true
          : "You need to select at least one model";
      },
      skip(): boolean {
        (this as any).state._choices = (this as any).state.choices;
        return !(this as any).state.answers.enableSagemakerModels;
      },
    },
    {
      type: "input",
      name: "huggingfaceApiSecretArn",
      message:
        "Some HuggingFace models including mistral now require an API key, Please enter an Secrets Manager Secret ARN (see docs: Model Requirements)",
      validate: (v: string) => {
        const valid = secretManagerArnRegExp.test(v);
        return v.length === 0 || valid
          ? true
          : "If you are supplying a HF API key it needs to be a reference to a secrets manager secret ARN";
      },
      initial: options.huggingfaceApiSecretArn || "",
      skip(): boolean {
        return !(this as any).state.answers.enableSagemakerModels;
      },
    },
    {
      type: "confirm",
      name: "enableSagemakerModelsSchedule",
      message:
        "Do you want to enable a start/stop schedule for sagemaker models?",
      initial(): boolean {
        return (
          (options.enableSagemakerModelsSchedule &&
            (this as any).state.answers.enableSagemakerModels) ||
          false
        );
      },
      skip(): boolean {
        return !(this as any).state.answers.enableSagemakerModels;
      },
    },
    {
      type: "AutoComplete",
      name: "timezonePicker",
      hint: "start typing to auto complete, ENTER to confirm selection",
      message: "Which TimeZone do you want to run the schedule in?",
      choices: timeZoneData,
      validate(choices: any) {
        return (this as any).skipped || choices.length > 0
          ? true
          : "You need to select at least one time zone";
      },
      skip(): boolean {
        return !(this as any).state.answers.enableSagemakerModelsSchedule;
      },
      initial: options.timezonePicker || [],
    },
    {
      type: "select",
      name: "enableCronFormat",
      choices: [
        { message: "Simple - Wizard lead", name: "simple" },
        { message: "Advanced - Provide cron expression", name: "cron" },
      ],
      message: "How do you want to set the schedule?",
      initial: options.enableCronFormat || "",
      skip(): boolean {
        (this as any).state._choices = (this as any).state.choices;
        return !(this as any).state.answers.enableSagemakerModelsSchedule;
      },
    },
    {
      type: "input",
      name: "sagemakerCronStartSchedule",
      hint: "This cron format is using AWS eventbridge cron syntax see docs for more information",
      message:
        "Start schedule for Sagmaker models expressed in UTC AWS cron format",
      skip(): boolean {
        return !(this as any).state.answers.enableCronFormat.includes("cron");
      },
      validate(v: string) {
        if ((this as any).skipped) {
          return true;
        }
        try {
          AWSCronValidator.validate(v);
          return true;
        } catch (error) {
          if (error instanceof Error) {
            return error.message;
          }
          return false;
        }
      },
      initial: options.cronSagemakerModelsScheduleStart,
    },
    {
      type: "input",
      name: "sagemakerCronStopSchedule",
      hint: "This cron format is using AWS eventbridge cron syntax see docs for more information",
      message: "Stop schedule for Sagmaker models expressed in AWS cron format",
      skip(): boolean {
        return !(this as any).state.answers.enableCronFormat.includes("cron");
      },
      validate(v: string) {
        if ((this as any).skipped) {
          return true;
        }
        try {
          AWSCronValidator.validate(v);
          return true;
        } catch (error) {
          if (error instanceof Error) {
            return error.message;
          }
          return false;
        }
      },
      initial: options.cronSagemakerModelsScheduleStop,
    },
    {
      type: "multiselect",
      name: "daysForSchedule",
      hint: "SPACE to select, ENTER to confirm selection",
      message: "Which days of the week would you like to run the schedule on?",
      choices: [
        { message: "Sunday", name: "SUN" },
        { message: "Monday", name: "MON" },
        { message: "Tuesday", name: "TUE" },
        { message: "Wednesday", name: "WED" },
        { message: "Thursday", name: "THU" },
        { message: "Friday", name: "FRI" },
        { message: "Saturday", name: "SAT" },
      ],
      validate(choices: any) {
        return (this as any).skipped || choices.length > 0
          ? true
          : "You need to select at least one day";
      },
      skip(): boolean {
        (this as any).state._choices = (this as any).state.choices;
        if (!(this as any).state.answers.enableSagemakerModelsSchedule) {
          return true;
        }
        return !(this as any).state.answers.enableCronFormat.includes("simple");
      },
      initial: options.daysForSchedule || [],
    },
    {
      type: "input",
      name: "scheduleStartTime",
      message:
        "What time of day do you wish to run the start schedule? enter in HH:MM format",
      validate(v: string) {
        if ((this as any).skipped) {
          return true;
        }
        // Regular expression to match HH:MM format
        const regex = /^([0-1]?[0-9]|2[0-3]):([0-5]?[0-9])$/;
        return regex.test(v) || "Time must be in HH:MM format!";
      },
      skip(): boolean {
        if (!(this as any).state.answers.enableSagemakerModelsSchedule) {
          return true;
        }
        return !(this as any).state.answers.enableCronFormat.includes("simple");
      },
      initial: options.scheduleStartTime,
    },
    {
      type: "input",
      name: "scheduleStopTime",
      message:
        "What time of day do you wish to run the stop schedule? enter in HH:MM format",
      validate(v: string) {
        if ((this as any).skipped) {
          return true;
        }
        // Regular expression to match HH:MM format
        const regex = /^([0-1]?[0-9]|2[0-3]):([0-5]?[0-9])$/;
        return regex.test(v) || "Time must be in HH:MM format!";
      },
      skip(): boolean {
        if (!(this as any).state.answers.enableSagemakerModelsSchedule) {
          return true;
        }
        return !(this as any).state.answers.enableCronFormat.includes("simple");
      },
      initial: options.scheduleStopTime,
    },
    {
      type: "confirm",
      name: "enableScheduleEndDate",
      message:
        "Would you like to set an end date for the start schedule? (after this date the models would no longer start)",
      initial: options.enableScheduleEndDate || false,
      skip(): boolean {
        return !(this as any).state.answers.enableSagemakerModelsSchedule;
      },
    },
    {
      type: "input",
      name: "startScheduleEndDate",
      message: "After this date the models will no longer start",
      hint: "YYYY-MM-DD",
      validate(v: string) {
        if ((this as any).skipped) {
          return true;
        }
        return (
          isValidDate(v) ||
          "The date must be in format YYYY-MM-DD and be in the future"
        );
      },
      skip(): boolean {
        return !(this as any).state.answers.enableScheduleEndDate;
      },
      initial: options.startScheduleEndDate || false,
    },
    {
      type: "confirm",
      name: "enableRag",
      message: "Do you want to enable RAG",
      initial: options.enableRag || false,
    },
    {
      type: "confirm",
      name: "deployDefaultSagemakerModels",
      message:
        "Do you want to deploy the default embedding and cross-encoder models via SageMaker?",
      initial: options.deployDefaultSagemakerModels || false,
      skip(): boolean {
        return !(this as any).state.answers.enableRag;
      },
    },
    {
      type: "multiselect",
      name: "ragsToEnable",
      hint: "SPACE to select, ENTER to confirm selection",
      message: "Which datastores do you want to enable for RAG",
      choices: [
        { message: "Aurora", name: "aurora" },
        { message: "OpenSearch", name: "opensearch" },
        { message: "Kendra (managed)", name: "kendra" },
        { message: "Bedrock KnowldgeBase", name: "knowledgeBase" },
      ],
      validate(choices: any) {
        return (this as any).skipped || choices.length > 0
          ? true
          : "You need to select at least one engine";
      },
      skip(): boolean {
        // workaround for https://github.com/enquirer/enquirer/issues/298
        (this as any).state._choices = (this as any).state.choices;
        return !(this as any).state.answers.enableRag;
      },
      initial: options.ragsToEnable || [],
    },
    {
      type: "confirm",
      name: "kendraEnterprise",
      message: "Do you want to enable Kendra Enterprise Edition?",
      initial: options.kendraEnterprise || false,
      skip(): boolean {
        return !(this as any).state.answers.ragsToEnable.includes("kendra");
      },
    },
    {
      type: "confirm",
      name: "kendra",
      message: "Do you want to add existing Kendra indexes",
      initial:
        (options.kendraExternal !== undefined &&
          options.kendraExternal.length > 0) ||
        false,
      skip(): boolean {
        return (
          !(this as any).state.answers.enableRag ||
          !(this as any).state.answers.ragsToEnable.includes("kendra")
        );
      },
    },
  ];

  const answers: any = await enquirer.prompt(questions);
  const kendraExternal: any[] = [];
  let newKendra = answers.enableRag && answers.kendra;
  const existingKendraIndices = Array.from(options.kendraExternal || []);
  while (newKendra === true) {
    const existingIndex: any = existingKendraIndices.pop();
    const kendraQ = [
      {
        type: "input",
        name: "name",
        message: "Kendra source name",
        validate(v: string) {
          return RegExp(/^\w[\w-_]*\w$/).test(v);
        },
        initial: existingIndex?.name,
      },
      {
        type: "autocomplete",
        limit: 8,
        name: "region",
        choices: Object.values(SupportedRegion),
        message: `Region of the Kendra index${
          existingIndex?.region ? " (" + existingIndex?.region + ")" : ""
        }`,
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

  // Knowledge Bases
  let newKB =
    answers.enableRag && answers.ragsToEnable.includes("knowledgeBase");
  const kbExternal: any[] = [];
  const existingKBIndices = Array.from(options.kbExternal || []);
  while (newKB === true) {
    const existingIndex: any = existingKBIndices.pop();
    const kbQ = [
      {
        type: "input",
        name: "name",
        message: "Bedrock KnowledgeBase source name",
        validate(v: string) {
          return RegExp(/^\w[\w-_]*\w$/).test(v);
        },
        initial: existingIndex?.name,
      },
      {
        type: "autocomplete",
        limit: 8,
        name: "region",
        choices: ["us-east-1", "us-west-2"],
        message: `Region of the Bedrock Knowledge Base index${
          existingIndex?.region ? " (" + existingIndex?.region + ")" : ""
        }`,
        initial: ["us-east-1", "us-west-2"].indexOf(existingIndex?.region),
      },
      {
        type: "input",
        name: "roleArn",
        message:
          "Cross account role Arn to assume to call the Bedrock KnowledgeBase, leave empty if not needed",
        validate: (v: string) => {
          const valid = iamRoleRegExp.test(v);
          return v.length === 0 || valid;
        },
        initial: existingIndex?.roleArn ?? "",
      },
      {
        type: "input",
        name: "knowledgeBaseId",
        message: "Bedrock KnowledgeBase ID",
        validate(v: string) {
          return /[A-Z0-9]{10}/.test(v);
        },
        initial: existingIndex?.knowledgeBaseId,
      },
      {
        type: "confirm",
        name: "enabled",
        message: "Enable this knowledge base",
        initial: existingIndex?.enabled ?? true,
      },
      {
        type: "confirm",
        name: "newKB",
        message: "Do you want to add another Bedrock KnowledgeBase source",
        initial: false,
      },
    ];
    const kbInstance: any = await enquirer.prompt(kbQ);
    const ext = (({ enabled, name, roleArn, knowledgeBaseId, region }) => ({
      enabled,
      name,
      roleArn,
      knowledgeBaseId,
      region,
    }))(kbInstance);
    if (ext.roleArn === "") ext.roleArn = undefined;
    kbExternal.push({
      ...ext,
    });
    newKB = kbInstance.newKB;
  }

  const modelsPrompts = [
    {
      type: "select",
      name: "defaultEmbedding",
      message: "Select a default embedding model",
      choices: embeddingModels.map((m) => ({ name: m.name, value: m })),
      initial: options.defaultEmbedding,
      validate(value: string) {
        if ((this as any).skipped) return true;
        const embeding = embeddingModels.find((i) => i.name === value);
        if (
          answers.enableRag &&
          embeding &&
          answers?.deployDefaultSagemakerModels === false &&
          embeding?.provider === "sagemaker"
        ) {
          return "SageMaker default models are not enabled. Please select another model.";
        }
        if (answers.enableRag) {
          return value ? true : "Select a default embedding model";
        }
        return true;
      },
      skip() {
        return (
          !answers.enableRag ||
          !(
            answers.ragsToEnable.includes("aurora") ||
            answers.ragsToEnable.includes("opensearch")
          )
        );
      },
    },
  ];
  const models: any = await enquirer.prompt(modelsPrompts);

  const advancedSettingsPrompts = [
    {
      type: "input",
      name: "llmRateLimitPerIP",
      message:
        "What is the allowed rate per IP for Gen AI calls (over 10 minutes)? This is used by the SendQuery mutation only",
      initial: options.llmRateLimitPerIP
        ? String(options.llmRateLimitPerIP)
        : "100",
      validate(value: string) {
        if (Number(value) >= 10) {
          return true;
        } else {
          return "Should be more than 10";
        }
      },
    },
    {
      type: "input",
      name: "rateLimitPerIP",
      message:
        "What the allowed per IP for all calls (over 10 minutes)? This is used by the all the AppSync APIs and CloudFront",
      initial: options.rateLimitPerAIP
        ? String(options.rateLimitPerAIP)
        : "400",
      validate(value: string) {
        if (Number(value) >= 10) {
          return true;
        } else {
          return "Should be more than 10";
        }
      },
    },
    {
      type: "input",
      name: "logRetention",
      message: "For how long do you want to store the logs (in days)?",
      initial: options.logRetention ? String(options.logRetention) : "7",
      validate(value: string) {
        // https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-logs-loggroup.html#cfn-logs-loggroup-retentionindays
        const allowed = [
          1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1096,
          1827, 2192, 2557, 2922, 3288, 3653,
        ];
        if (allowed.includes(Number(value))) {
          return true;
        } else {
          return "Allowed values are: " + allowed.join(", ");
        }
      },
    },
    {
      type: "confirm",
      name: "advancedMonitoring",
      message:
        "Do you want to use Amazon CloudWatch custom metrics, alarms and AWS X-Ray?",
      initial: options.advancedMonitoring || false,
    },
    {
      type: "confirm",
      name: "createVpcEndpoints",
      message: "Do you want create VPC Endpoints?",
      initial: options.createVpcEndpoints || false,
      skip(): boolean {
        return !(this as any).state.answers.existingVpc;
      },
    },
    {
      type: "confirm",
      name: "privateWebsite",
      message:
        "Do you want to deploy a private website? I.e only accessible in VPC",
      initial: options.privateWebsite || false,
    },
    {
      type: "confirm",
      name: "customPublicDomain",
      message:
        "Do you want to provide a custom domain name and corresponding certificate arn for the public website ?",
      initial: options.domain ? true : false,
      skip(): boolean {
        return (this as any).state.answers.privateWebsite;
      },
    },
    {
      type: "input",
      name: "certificate",
      validate(v: string) {
        if ((this as any).state.answers.privateWebsite) {
          const valid = acmCertRegExp.test(v);
          return (this as any).skipped || valid
            ? true
            : "You need to enter an ACM certificate arn";
        } else {
          const valid = cfAcmCertRegExp.test(v);
          return (this as any).skipped || valid
            ? true
            : "You need to enter an ACM certificate arn in us-east-1 for CF";
        }
      },
      message(): string {
        if ((this as any).state.answers.customPublicDomain) {
          return "ACM certificate ARN with custom domain for public website. Note that the certificate must resides in us-east-1";
        }
        return "ACM certificate ARN";
      },
      initial: options.certificate,
      skip(): boolean {
        return (
          !(this as any).state.answers.privateWebsite &&
          !(this as any).state.answers.customPublicDomain
        );
      },
    },
    {
      type: "input",
      name: "domain",
      message(): string {
        if ((this as any).state.answers.customPublicDomain) {
          return "Custom Domain for public website i.e example.com";
        }
        return "Domain for private website i.e example.com";
      },
      validate(v: any) {
        return (this as any).skipped || v.length > 0
          ? true
          : "You need to enter a domain name";
      },
      initial: options.domain,
      skip(): boolean {
        return (
          !(this as any).state.answers.privateWebsite &&
          !(this as any).state.answers.customPublicDomain
        );
      },
    },
    {
      type: "confirm",
      name: "cognitoFederationEnabled",
      message: "Do you want to enable Federated (SSO) login with Cognito?",
      initial: options.cognitoFederationEnabled || false,
    },
    {
      type: "input",
      name: "cognitoCustomProviderName",
      message:
        "Please enter the name of the SAML/OIDC Federated identity provider that is or will be setup in Cognito",
      skip(): boolean {
        return !(this as any).state.answers.cognitoFederationEnabled;
      },
      initial: options.cognitoCustomProviderName || "",
    },
    {
      type: "select",
      name: "cognitoCustomProviderType",
      choices: [
        { message: "Custom Cognito SAML", name: "SAML" },
        { message: "Custom Cognito OIDC", name: "OIDC" },
        { message: "Setup in Cognito Later", name: "later" },
      ],
      message:
        "Do you want to setup a SAML or OIDC provider? or choose to do this later after install",
      skip(): boolean {
        (this as any).state._choices = (this as any).state.choices;
        return !(this as any).state.answers.cognitoFederationEnabled;
      },
      initial: options.cognitoCustomProviderType || "",
    },
    {
      type: "input",
      name: "cognitoCustomProviderSAMLMetadata",
      message:
        "Provide a URL to a SAML metadata document. This document is issued by your SAML provider.",
      validate(v: string) {
        return (this as any).skipped || StringUtils.isUrl(v)
          ? true
          : "That does not look like a valid URL";
      },
      skip(): boolean {
        if (!(this as any).state.answers.cognitoFederationEnabled) {
          return true;
        }
        return !(this as any).state.answers.cognitoCustomProviderType.includes(
          "SAML"
        );
      },
      initial: options.cognitoCustomProviderSAMLMetadata || "",
    },
    {
      type: "input",
      name: "cognitoCustomProviderOIDCClient",
      message:
        "Enter the client ID provided by OpenID Connect identity provider.",
      validate(v: string) {
        if ((this as any).skipped) {
          return true;
        }
        // Regular expression to match HH:MM format
        const regex = /^[a-zA-Z0-9-_]{1,255}$/;
        return (
          regex.test(v) ||
          'Must only contain Alpha Numeric characters, "-" or "_" and be a maximum of 255 in length.'
        );
      },
      skip(): boolean {
        if (!(this as any).state.answers.cognitoFederationEnabled) {
          return true;
        }
        return !(this as any).state.answers.cognitoCustomProviderType.includes(
          "OIDC"
        );
      },
      initial: options.cognitoCustomProviderOIDCClient || "",
    },
    {
      type: "input",
      name: "cognitoCustomProviderOIDCSecret",
      validate(v: string) {
        const valid = secretManagerArnRegExp.test(v);
        return (this as any).skipped || valid
          ? true
          : "You need to enter an Secret Manager Secret arn";
      },
      message:
        "Enter the secret manager ARN containing the OIDC client secret to use (see docs for info)",
      skip(): boolean {
        if (!(this as any).state.answers.cognitoFederationEnabled) {
          return true;
        }
        return !(this as any).state.answers.cognitoCustomProviderType.includes(
          "OIDC"
        );
      },
      initial: options.cognitoCustomProviderOIDCSecret || "",
    },
    {
      type: "input",
      name: "cognitoCustomProviderOIDCIssuerURL",
      message: "Enter the issuer URL you received from the OIDC provider.",
      validate(v: string) {
        return (this as any).skipped || StringUtils.isUrl(v)
          ? true
          : "That does not look like a valid URL";
      },
      skip(): boolean {
        if (!(this as any).state.answers.cognitoFederationEnabled) {
          return true;
        }
        return !(this as any).state.answers.cognitoCustomProviderType.includes(
          "OIDC"
        );
      },
      initial: options.cognitoCustomProviderOIDCIssuerURL || "",
    },
    {
      type: "confirm",
      name: "cognitoAutoRedirect",
      message:
        "Would you like to automatically redirect users to this identity provider?",
      skip(): boolean {
        return !(this as any).state.answers.cognitoFederationEnabled;
      },
      initial: options.cognitoAutoRedirect || false,
    },
    {
      type: "confirm",
      name: "cfGeoRestrictEnable",
      message:
        "Do want to restrict access to the website (CF Distribution) to only a country or countries?",
      initial: options.cfGeoRestrictEnable || false,
      skip(): boolean {
        return (this as any).state.answers.privateWebsite;
      },
    },
    {
      type: "multiselect",
      name: "cfGeoRestrictList",
      hint: "SPACE to select, ENTER to confirm selection",
      message: "Which countries do you wish to ALLOW access?",
      choices: cfCountries,
      validate(choices: any) {
        return (this as any).skipped || choices.length > 0
          ? true
          : "You need to select at least one country";
      },
      skip(): boolean {
        (this as any).state._choices = (this as any).state.choices;
        return (
          !(this as any).state.answers.cfGeoRestrictEnable ||
          (this as any).state.answers.privateWebsite
        );
      },
      initial: options.cfGeoRestrictList || [],
    },
  ];

  const doAdvancedConfirm: any = await enquirer.prompt([
    {
      type: "confirm",
      name: "doAdvancedSettings",
      message: "Do you want to configure advanced settings?",
      initial: false,
    },
  ]);

  let advancedSettings: any = {};
  if (doAdvancedConfirm.doAdvancedSettings) {
    advancedSettings = await enquirer.prompt(advancedSettingsPrompts);
  }
  // Convert simple time into cron format for schedule
  if (
    answers.enableSagemakerModelsSchedule &&
    answers.enableCronFormat == "simple"
  ) {
    const daysToRunSchedule = answers.daysForSchedule.join(",");
    const startMinutes = answers.scheduleStartTime.split(":")[1];
    const startHour = answers.scheduleStartTime.split(":")[0];
    answers.sagemakerCronStartSchedule = `${startMinutes} ${startHour} ? * ${daysToRunSchedule} *`;
    AWSCronValidator.validate(answers.sagemakerCronStartSchedule);

    const stopMinutes = answers.scheduleStopTime.split(":")[1];
    const stopHour = answers.scheduleStopTime.split(":")[0];
    answers.sagemakerCronStopSchedule = `${stopMinutes} ${stopHour} ? * ${daysToRunSchedule} *`;
    AWSCronValidator.validate(answers.sagemakerCronStopSchedule);
  }

  const randomSuffix = randomBytes(8).toString("hex");
  // Create the config object
  const config = {
    prefix: answers.prefix,
    createCMKs: answers.createCMKs,
    retainOnDelete: answers.retainOnDelete,
    ddbDeletionProtection: answers.ddbDeletionProtection,
    vpc: answers.existingVpc
      ? {
          vpcId: answers.vpcId.toLowerCase(),
          createVpcEndpoints: advancedSettings.createVpcEndpoints,
        }
      : undefined,
    privateWebsite: advancedSettings.privateWebsite,
    advancedMonitoring: advancedSettings.advancedMonitoring,
    logRetention: advancedSettings.logRetention
      ? Number(advancedSettings.logRetention)
      : undefined,
    rateLimitPerAIP: advancedSettings?.rateLimitPerIP
      ? Number(advancedSettings?.rateLimitPerIP)
      : undefined,
    certificate: advancedSettings.certificate,
    domain: advancedSettings.domain,
    cognitoFederation: advancedSettings.cognitoFederationEnabled
      ? {
          enabled: advancedSettings.cognitoFederationEnabled,
          autoRedirect: advancedSettings.cognitoAutoRedirect,
          customProviderName: advancedSettings.cognitoCustomProviderName,
          customProviderType: advancedSettings.cognitoCustomProviderType,
          customSAML:
            advancedSettings.cognitoCustomProviderType == "SAML"
              ? {
                  metadataDocumentUrl:
                    advancedSettings.cognitoCustomProviderSAMLMetadata,
                }
              : undefined,
          customOIDC:
            advancedSettings.cognitoCustomProviderType == "OIDC"
              ? {
                  OIDCClient: advancedSettings.cognitoCustomProviderOIDCClient,
                  OIDCSecret: advancedSettings.cognitoCustomProviderOIDCSecret,
                  OIDCIssuerURL:
                    advancedSettings.cognitoCustomProviderOIDCIssuerURL,
                }
              : undefined,
          cognitoDomain: advancedSettings.cognitoDomain
            ? advancedSettings.cognitoDomain
            : `llm-cb-${randomSuffix}`,
        }
      : undefined,
    cfGeoRestrictEnable: advancedSettings.cfGeoRestrictEnable,
    cfGeoRestrictList: advancedSettings.cfGeoRestrictList,
    bedrock: answers.bedrockEnable
      ? {
          enabled: answers.bedrockEnable,
          region: answers.bedrockRegion,
          roleArn:
            answers.bedrockRoleArn === "" ? undefined : answers.bedrockRoleArn,
          guardrails: {
            enabled: answers.guardrailsEnable,
            identifier: answers.guardrailsIdentifier,
            version: answers.guardrailsVersion,
          },
        }
      : undefined,
    llms: {
      enableSagemakerModels: answers.enableSagemakerModels,
      rateLimitPerAIP: advancedSettings?.llmRateLimitPerIP
        ? Number(advancedSettings?.llmRateLimitPerIP)
        : undefined,
      sagemaker: answers.sagemakerModels,
      huggingfaceApiSecretArn: answers.huggingfaceApiSecretArn,
      sagemakerSchedule: answers.enableSagemakerModelsSchedule
        ? {
            enabled: answers.enableSagemakerModelsSchedule,
            timezonePicker: answers.timezonePicker,
            enableCronFormat: answers.enableCronFormat,
            sagemakerCronStartSchedule: answers.sagemakerCronStartSchedule,
            sagemakerCronStopSchedule: answers.sagemakerCronStopSchedule,
            daysForSchedule: answers.daysForSchedule,
            scheduleStartTime: answers.scheduleStartTime,
            scheduleStopTime: answers.scheduleStopTime,
            enableScheduleEndDate: answers.enableScheduleEndDate,
            startScheduleEndDate: answers.startScheduleEndDate,
          }
        : undefined,
    },
    rag: {
      enabled: answers.enableRag,
      deployDefaultSagemakerModels: answers.deployDefaultSagemakerModels,
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
          enterprise: false,
        },
        knowledgeBase: {
          enabled: false,
          external: [{}],
        },
      },
      embeddingsModels: [] as ModelConfig[],
      crossEncoderModels: [] as ModelConfig[],
    },
  };

  if (config.rag.enabled && config.rag.deployDefaultSagemakerModels) {
    config.rag.crossEncoderModels[0] = {
      provider: "sagemaker",
      name: "cross-encoder/ms-marco-MiniLM-L-12-v2",
      default: true,
    };
    config.rag.embeddingsModels = embeddingModels;
  } else if (config.rag.enabled) {
    config.rag.embeddingsModels = embeddingModels.filter(
      (model) => model.provider !== "sagemaker"
    );
  } else {
    config.rag.embeddingsModels = [];
  }

  if (config.rag.embeddingsModels.length > 0 && models.defaultEmbedding) {
    for (const model of config.rag.embeddingsModels) {
      model.default = model.name === models.defaultEmbedding;
    }
  }

  config.rag.engines.kendra.createIndex =
    answers.ragsToEnable.includes("kendra");
  config.rag.engines.kendra.enabled =
    config.rag.engines.kendra.createIndex || kendraExternal.length > 0;
  config.rag.engines.kendra.external = [...kendraExternal];
  config.rag.engines.kendra.enterprise = answers.kendraEnterprise;

  config.rag.engines.knowledgeBase.external = [...kbExternal];
  config.rag.engines.knowledgeBase.enabled =
    config.rag.engines.knowledgeBase.external.length > 0;

  console.log("\n✨ This is the chosen configuration:\n");
  console.log(JSON.stringify(config, undefined, 2));
  (
    (await enquirer.prompt([
      {
        type: "confirm",
        name: "create",
        message:
          "Do you want to create/update the configuration based on the above settings",
        initial: true,
      },
    ])) as any
  ).create
    ? createConfig(config)
    : console.log("Skipping");
}
