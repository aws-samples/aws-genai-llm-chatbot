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
} from "../lib/shared/types";
import { LIB_VERSION } from "./version.js";
import * as fs from "fs";
import { AWSCronValidator } from "./aws-cron-validator"
import { tz } from 'moment-timezone';
import { getData } from 'country-list';

function getTimeZonesWithCurrentTime(): { message: string; name: string }[] {
    const timeZones = tz.names(); // Get a list of all timezones
    const timeZoneData = timeZones.map(zone => {
        // Get current time in each timezone
        const currentTime = tz(zone).format('YYYY-MM-DD HH:mm');
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
  // Check the pattern YYYY/MM/DD
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
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
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
      options.vpcId = config.vpc?.vpcId;
      options.createVpcEndpoints = config.vpc?.createVpcEndpoints;
      options.privateWebsite = config.privateWebsite;
      options.certificate = config.certificate;
      options.domain = config.domain;
      options.cfGeoRestrictEnable = config.cfGeoRestrictEnable;
      options.cfGeoRestrictList = config.cfGeoRestrictList;
      options.bedrockEnable = config.bedrock?.enabled;
      options.bedrockRegion = config.bedrock?.region;
      options.bedrockRoleArn = config.bedrock?.roleArn;
      options.sagemakerModels = config.llms?.sagemaker ?? [];
      options.enableSagemakerModels = config.llms?.sagemaker
        ? config.llms?.sagemaker.length > 0
        : false;
      options.enableSagemakerModelsSchedule = config.llms?.sagemakerSchedule?.enabled;
      options.timezonePicker = config.llms?.sagemakerSchedule?.timezonePicker;
      options.enableCronFormat = config.llms?.sagemakerSchedule?.enableCronFormat;
      options.cronSagemakerModelsScheduleStart = config.llms?.sagemakerSchedule?.sagemakerCronStartSchedule;
      options.cronSagemakerModelsScheduleStop = config.llms?.sagemakerSchedule?.sagemakerCronStopSchedule;
      options.daysForSchedule = config.llms?.sagemakerSchedule?.daysForSchedule;
      options.scheduleStartTime = config.llms?.sagemakerSchedule?.scheduleStartTime;
      options.scheduleStopTime = config.llms?.sagemakerSchedule?.scheduleStopTime;
      options.enableScheduleEndDate = config.llms?.sagemakerSchedule?.enableScheduleEndDate;
      options.startScheduleEndDate = config.llms?.sagemakerSchedule?.startScheduleEndDate;
      options.enableRag = config.rag.enabled;
      options.ragsToEnable = Object.keys(config.rag.engines ?? {}).filter(
        (v: string) => (config.rag.engines as any)[v].enabled
      );
      if (
        options.ragsToEnable.includes("kendra") &&
        !config.rag.engines.kendra.createIndex
      ) {
        options.ragsToEnable.pop("kendra");
      }
      options.embeddings = config.rag.embeddingsModels.map((m: any) => m.name);
      options.defaultEmbedding = (config.rag.embeddingsModels ?? []).filter(
        (m: any) => m.default
      )[0].name;
      options.kendraExternal = config.rag.engines.kendra.external;
      options.kendraEnterprise = config.rag.engines.kendra.enterprise;
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
  console.log("Configuration written to ./bin/config.json");
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
      name: "existingVpc",
      message: "Do you want to use existing vpc? (selecting false will create a new vpc)",
      initial: options.vpcId ? true : false,
    },
    {
      type: "input",
      name: "vpcId",
      message: "Specify existing VpcId (vpc-xxxxxxxxxxxxxxxxx)",
      initial: options.vpcId,
      validate(vpcId: string) {
        return ((this as any).skipped || RegExp(/^vpc-[0-9a-f]{8,17}$/i).test(vpcId)) ?
          true : 'Enter a valid VpcId in vpc-xxxxxxxxxxx format'
      },
      skip(): boolean {
        return !(this as any).state.answers.existingVpc;
      },
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
      initial: options.customPublicDomain || false,
      skip(): boolean {
        return (this as any).state.answers.privateWebsite ;
      },
    },
    {
      type: "input",
      name: "certificate",
      message(): string {
        if ((this as any).state.answers.customPublicDomain) {
          return "ACM certificate ARN with custom domain for public website. Note that the certificate must resides in us-east-1";
        }
        return "ACM certificate ARN";
      },
      initial: options.certificate,
      skip(): boolean {
        return !(this as any).state.answers.privateWebsite && !(this as any).state.answers.customPublicDomain;
      },
    },
    {
      type: "input",
      name: "domain",
      message(): string {
        if ((this as any).state.answers.customPublicDomain) {
          return "Custom Domain for public website";
        }
        return "Domain for private website";
      },
      initial: options.domain,
      skip(): boolean {
        return !(this as any).state.answers.privateWebsite && !(this as any).state.answers.customPublicDomain;
      },
    },
    {
      type: "confirm",
      name: "cfGeoRestrictEnable",
      message: "Do want to restrict access to the website (CF Distribution) to only a country or countries?",
      initial: false,
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
        return !(this as any).state.answers.cfGeoRestrictEnable;
      },
      initial: options.cfGeoRestrictList || [],
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
      initial: options.bedrockRoleArn || "",
    },
    {
      type: "confirm",
      name: "enableSagemakerModels",
      message: "Do you want to use any Sagemaker Models",
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
        //Trap for new players, validate always runs even if skipped is true
        // So need to handle validate bail out if skipped is true
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
      type: "confirm",
      name: "enableSagemakerModelsSchedule",
      message: "Do you want to enable a start/stop schedule for sagemaker models?",
      initial(): boolean {
        return (options.enableSagemakerModelsSchedule && (this as any).state.answers.enableSagemakerModels) || false;
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
      message: "Start schedule for Sagmaker models expressed in UTC AWS cron format",
      skip(): boolean {
        return !(this as any).state.answers.enableCronFormat.includes("cron");
      },
      validate(v: string) {
        if ((this as any).skipped) {
          return true
        }
        try {
          AWSCronValidator.validate(v)
          return true
        }
        catch (error) {
          if (error instanceof Error){
            return error.message
          }
          return false
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
          return true
        }
        try {
          AWSCronValidator.validate(v)
          return true
        }
        catch (error) {
          if (error instanceof Error){
            return error.message
          }
          return false
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
        if (!(this as any).state.answers.enableSagemakerModelsSchedule){
          return true;
        }
        return !(this as any).state.answers.enableCronFormat.includes("simple");
      },
      initial: options.daysForSchedule || [],
    },
    {
      type: "input",
      name: "scheduleStartTime",
      message: "What time of day do you wish to run the start schedule? enter in HH:MM format",
      validate(v: string) {
        if ((this as any).skipped) {
          return true
        }
        // Regular expression to match HH:MM format
        const regex = /^([0-1]?[0-9]|2[0-3]):([0-5]?[0-9])$/;
        return regex.test(v) || 'Time must be in HH:MM format!';
      },
      skip(): boolean {
        if (!(this as any).state.answers.enableSagemakerModelsSchedule){
          return true;
        }
        return !(this as any).state.answers.enableCronFormat.includes("simple");
      },
      initial: options.scheduleStartTime,
    },
    {
      type: "input",
      name: "scheduleStopTime",
      message: "What time of day do you wish to run the stop schedule? enter in HH:MM format",
      validate(v: string) {
        if ((this as any).skipped) {
          return true
        }
        // Regular expression to match HH:MM format
        const regex = /^([0-1]?[0-9]|2[0-3]):([0-5]?[0-9])$/;
        return regex.test(v) || 'Time must be in HH:MM format!';
      },
      skip(): boolean {
        if (!(this as any).state.answers.enableSagemakerModelsSchedule){
          return true;
        }
        return !(this as any).state.answers.enableCronFormat.includes("simple");
      },
      initial: options.scheduleStopTime,
    },
    {
      type: "confirm",
      name: "enableScheduleEndDate",
      message: "Would you like to set an end data for the start schedule? (after this date the models would no longer start)",
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
          return true
        }
        return isValidDate(v) || 'The date must be in format YYYY/MM/DD and be in the future';
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
      type: "multiselect",
      name: "ragsToEnable",
      hint: "SPACE to select, ENTER to confirm selection",
      message: "Which datastores do you want to enable for RAG",
      choices: [
        { message: "Aurora", name: "aurora" },
        { message: "OpenSearch", name: "opensearch" },
        { message: "Kendra (managed)", name: "kendra" },
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
        return !(this as any).state.answers.enableRag;
      },
    },
  ];
  const answers: any = await enquirer.prompt(questions);
  const kendraExternal: any[] = [];
  let newKendra = answers.enableRag && answers.kendra;
  const existingKendraIndices = Array.from(options.kendraExternal || []);
  while (newKendra === true) {
    let existingIndex: any = existingKendraIndices.pop();
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
  const modelsPrompts = [
    {
      type: "select", 
      name: "defaultEmbedding",
      message: "Select a default embedding model",
      choices: embeddingModels.map(m => ({name: m.name, value: m})),
      initial: options.defaultEmbedding,
      validate(value: string) {
        if ((this as any).state.answers.enableRag) {
          return value ? true : 'Select a default embedding model'; 
        }
      
        return true;
      },
      skip() {
        return !answers.enableRag || !(answers.ragsToEnable.includes("aurora") || answers.ragsToEnable.includes("opensearch"));
      }
    }
  ];
  const models: any = await enquirer.prompt(modelsPrompts);

  // Convert simple time into cron format for schedule
  if (answers.enableSagemakerModelsSchedule && answers.enableCronFormat == "simple")
  {
    const daysToRunSchedule = answers.daysForSchedule.join(",");
    const startMinutes = answers.scheduleStartTime.split(":")[1];
    const startHour = answers.scheduleStartTime.split(":")[0];
    answers.sagemakerCronStartSchedule = `${startMinutes} ${startHour} ? * ${daysToRunSchedule} *`;
    AWSCronValidator.validate(answers.sagemakerCronStartSchedule)

    
    const stopMinutes = answers.scheduleStopTime.split(":")[1];
    const stopHour = answers.scheduleStopTime.split(":")[0];
    answers.sagemakerCronStopSchedule = `${stopMinutes} ${stopHour} ? * ${daysToRunSchedule} *`;
    AWSCronValidator.validate(answers.sagemakerCronStopSchedule)
  }
  
  // Create the config object
  const config = {
    prefix: answers.prefix,
    vpc: answers.existingVpc
      ? {
          vpcId: answers.vpcId.toLowerCase(),
          createVpcEndpoints: answers.createVpcEndpoints,
      }
      : undefined,
    privateWebsite: answers.privateWebsite,
    certificate: answers.certificate,
    domain: answers.domain,
    cfGeoRestrictEnable: answers.cfGeoRestrictEnable,
    cfGeoRestrictList: answers.cfGeoRestrictList,
    bedrock: answers.bedrockEnable
      ? {
          enabled: answers.bedrockEnable,
          region: answers.bedrockRegion,
          roleArn:
            answers.bedrockRoleArn === "" ? undefined : answers.bedrockRoleArn,
        }
      : undefined,
    llms: {
      sagemaker: answers.sagemakerModels,
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
      },
      embeddingsModels: [{}],
      crossEncoderModels: [{}],
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
  };
  config.rag.embeddingsModels = embeddingModels;
  config.rag.embeddingsModels.forEach((m: any) => {
    if (m.name === models.defaultEmbedding) {
      m.default = true;
    }
  });

  config.rag.engines.kendra.createIndex =
    answers.ragsToEnable.includes("kendra");
  config.rag.engines.kendra.enabled =
    config.rag.engines.kendra.createIndex || kendraExternal.length > 0;
  config.rag.engines.kendra.external = [...kendraExternal];
  config.rag.engines.kendra.enterprise = answers.kendraEnterprise;

  console.log("\n✨ This is the chosen configuration:\n");
  console.log(JSON.stringify(config, undefined, 2));
  (
    (await enquirer.prompt([
      {
        type: "confirm",
        name: "create",
        message: "Do you want to create/update the configuration based on the above settings",
        initial: true,
      },
    ])) as any
  ).create
    ? createConfig(config)
    : console.log("Skipping");
}
