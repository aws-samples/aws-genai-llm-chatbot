#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';

import { AwsGenaiLllmChatbotStack } from '../lib/aws-genai-llm-chatbot-stack';

const app = new cdk.App();
new AwsGenaiLllmChatbotStack(app, 'AwsGenaiLllmChatbotStack');
