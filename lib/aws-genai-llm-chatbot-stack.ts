import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { SystemConfig, ModelInterface, Direction } from "./shared/types";
import { Authentication } from "./authentication";
import { UserInterface } from "./user-interface";
import { Shared } from "./shared";
import { ChatBotApi } from "./chatbot-api";
import { RagEngines } from "./rag-engines";
import { Models } from "./models";
import { LangChainInterface } from "./model-interfaces/langchain";
import { IdeficsInterface } from "./model-interfaces/idefics";
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
    const models = new Models(this, "Models", {
      config: props.config,
      shared,
    });

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
      modelsParameter: models.modelsParameter,
      models: models.models,
    });

    // Langchain Interface Construct
    // This is the model interface recieving messages from the websocket interface via the message topic
    // and interacting with the model via LangChain library
    const langchainModels = models.models.filter(
      (model) => model.interface === ModelInterface.LangChain
    );

    // check if any deployed model requires langchain interface or if bedrock is enabled from config
    if (langchainModels.length > 0 || props.config.bedrock?.enabled) {
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

      // Route all incoming messages targeted to langchain to the langchain model interface queue
      chatBotApi.messagesTopic.addSubscription(
        new subscriptions.SqsSubscription(langchainInterface.ingestionQueue, {
          filterPolicyWithMessageBody: {
            direction: sns.FilterOrPolicy.filter(
              sns.SubscriptionFilter.stringFilter({
                allowlist: [Direction.In],
              })
            ),
            modelInterface: sns.FilterOrPolicy.filter(
              sns.SubscriptionFilter.stringFilter({
                allowlist: [ModelInterface.LangChain],
              })
            ),
          },
        })
      );

      for (const model of models.models) {
        if (model.interface === ModelInterface.LangChain) {
          langchainInterface.addSageMakerEndpoint(model);
        }
      }
    }

    // IDEFICS Interface Construct
    // This is the model interface recieving messages from the websocket interface via the message topic
    // and interacting with IDEFICS visual language models
    const ideficsModels = models.models.filter(
      (model) => model.interface === ModelInterface.Idefics
    );

    // check if any deployed model requires idefics interface
    if (ideficsModels.length > 0) {
      const ideficsInterface = new IdeficsInterface(this, "IdeficsInterface", {
        shared,
        config: props.config,
        messagesTopic: chatBotApi.messagesTopic,
        sessionsTable: chatBotApi.sessionsTable,
        byUserIdIndex: chatBotApi.byUserIdIndex,
        chatbotFilesBucket: chatBotApi.filesBucket,
      });

      // Route all incoming messages targeted to idefics to the idefics model interface queue
      chatBotApi.messagesTopic.addSubscription(
        new subscriptions.SqsSubscription(ideficsInterface.ingestionQueue, {
          filterPolicyWithMessageBody: {
            direction: sns.FilterOrPolicy.filter(
              sns.SubscriptionFilter.stringFilter({
                allowlist: [Direction.In],
              })
            ),
            modelInterface: sns.FilterOrPolicy.filter(
              sns.SubscriptionFilter.stringFilter({
                allowlist: [ModelInterface.Idefics],
              })
            ),
          },
        })
      );

      for (const model of models.models) {
        // if model name contains idefics then add to idefics interface
        if (model.interface === ModelInterface.Idefics) {
          ideficsInterface.addSageMakerEndpoint(model);
        }
      }
    }

    new UserInterface(this, "UserInterface", {
      shared,
      config: props.config,
      userPoolId: authentication.userPool.userPoolId,
      userPoolClientId: authentication.userPoolClient.userPoolClientId,
      identityPool: authentication.identityPool,
      api: chatBotApi,
      chatbotFilesBucket: chatBotApi.filesBucket,
      crossEncodersEnabled:
        typeof ragEngines?.sageMakerRagModels?.model !== "undefined",
      sagemakerEmbeddingsEnabled:
        typeof ragEngines?.sageMakerRagModels?.model !== "undefined",
    });
  }
}
