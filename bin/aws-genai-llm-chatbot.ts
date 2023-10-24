#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import "source-map-support/register";
import { AwsGenAILLMChatbotStack } from "../lib/aws-genai-llm-chatbot-stack";
import { getConfig } from "./config";

const app = new cdk.App();

const config = getConfig();

new AwsGenAILLMChatbotStack(app, `${config.prefix}GenAIChatBotStack`, {
  config,
  env: {
    region: process.env.CDK_DEFAULT_REGION,
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
});
