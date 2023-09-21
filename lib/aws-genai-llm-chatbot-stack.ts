import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { SystemConfig } from "./shared/types";
import { Authentication } from "./authentication";
import { UserInterface } from "./user-interface";
import { Shared } from "./shared";
import { ChatBotApi } from "./chatbot-api";
import { RagEngines } from "./rag-engines";
import { LargeLanguageModels } from "./llms";
import { LangChainInterface } from "./model-interfaces/langchain";
import * as subscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import * as sns from "aws-cdk-lib/aws-sns";

export interface AwsGenAILLMChatbotStackProps extends cdk.StackProps {
  readonly config: SystemConfig;
}

export class AwsGenAILLMChatbotStack extends cdk.Stack {
  constructor(
    scope: Construct,
    id: string,
    props: AwsGenAILLMChatbotStackProps
  ) {
    super(scope, id, {
      description: "AWS LLM CHATBOT (uksb-1tupboc16)",
      ...props,
    });

    const shared = new Shared(this, "Shared", { config: props.config });
    const authentication = new Authentication(this, "Authentication");
    const languageModels = new LargeLanguageModels(
      this,
      "LargeLanguageModels",
      {
        config: props.config,
        shared,
      }
    );

    let ragEngines: RagEngines | undefined = undefined;
    if (props.config.rag.enabled) {
      ragEngines = new RagEngines(this, "RagEngines", {
        shared,
        config: props.config,
      });
    }

    const chatBotApi = new ChatBotApi(this, "ChatBotApi", {
      shared,
      config: props.config,
      ragEngines: ragEngines,
      userPool: authentication.userPool,
      llms: languageModels.llms,
      llmsParameter: languageModels.llmsParameter,
    });

    // Langchain Interface Construct
    // This is the model interface recieving messages from the websocket interface via the message topic
    // and interacting with the model via LangChain library
    const langchainInterface = new LangChainInterface(
      this,
      "LangchainInterface",
      {
        shared,
        config: props.config,
        ragEngines,
        messagesTopic: chatBotApi.messagesTopic,
        sessionsTable: chatBotApi.sessionsTable,
        byUserIdIndex: chatBotApi.byUserIdIndex,
      }
    );

    // Route all incoming messages to the langchain model interface queue
    chatBotApi.messagesTopic.addSubscription(
      new subscriptions.SqsSubscription(langchainInterface.ingestionQueue, {
        filterPolicyWithMessageBody: {
          direction: sns.FilterOrPolicy.filter(
            sns.SubscriptionFilter.stringFilter({
              allowlist: ["IN"],
            })
          ),
        },
      })
    );

    for (const model of languageModels.llms) {
      langchainInterface.addSageMakerEndpoint(model);
    }

    new UserInterface(this, "UserInterface", {
      shared,
      config: props.config,
      userPoolId: authentication.userPool.userPoolId,
      userPoolClientId: authentication.userPoolClient.userPoolClientId,
      restApi: chatBotApi.restApi,
      webSocketApi: chatBotApi.webSocketApi,
    });
  }
}
