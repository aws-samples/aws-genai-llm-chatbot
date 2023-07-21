#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';

import { ChatBotStack } from '../lib/chatbot-stack';
import { ChatBotUIStack } from '../lib/chatbot-ui-stack';
import { ChatBotVpcStack } from '../lib/chatbot-vpc-stack';
import { AuroraSemanticSearchStack } from '../lib/aurora-semantic-search/aurora-semantic-search-stack';

const config = {
  deployUI: true,
  deploySemanticSearch: false,
  prefix: 'GenAI',
  maxParallelLLMQueries: 10,
};

const app = new cdk.App();
const chatBotVpcStack = new ChatBotVpcStack(
  app,
  `${config.prefix}-ChatBotVpcStack`
);

let semanticSearchApi: lambda.Function | null = null;
if (config.deploySemanticSearch) {
  const semanticSearch = new AuroraSemanticSearchStack(
    app,
    `${config.prefix}-AuroraSemanticSearchStack`,
    {
      vpc: chatBotVpcStack.vpc,
    }
  );

  semanticSearchApi = semanticSearch.semanticSearchApi;
}

const chatBotStack = new ChatBotStack(app, `${config.prefix}-ChatBotStack`, {
  prefix: config.prefix,
  vpc: chatBotVpcStack.vpc,
  semanticSearchApi,
  maxParallelLLMQueries: config.maxParallelLLMQueries,
});

if (config.deployUI) {
  const chatBotUIStack = new ChatBotUIStack(
    app,
    `${config.prefix}-ChatBotUIStack`,
    {
      prefix: config.prefix,
    }
  );
  chatBotUIStack.addDependency(chatBotStack);
}
