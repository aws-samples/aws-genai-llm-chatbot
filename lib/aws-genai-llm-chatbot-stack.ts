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
import { NagSuppressions } from "cdk-nag";

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

    /**
     * CDK NAG suppression
     */
    NagSuppressions.addResourceSuppressionsByPath(this,
      [
        `/${this.stackName}/Shared/VPC/FlowLogS3/Bucket/Resource`,
        `/${this.stackName}/Shared/VPC/FlowLogS3/Bucket/Policy/Resource`
      ],
      [
        {id: "AwsSolutions-S1", reason: "S3 Bucket implicitly created by CDK VPC resource."},
        {id: "AwsSolutions-S10", reason: "S3 Bucket implicitly created by CDK VPC resource."}
      ]
    );
    NagSuppressions.addResourceSuppressionsByPath(this,
      [
        `/${this.stackName}/Custom::CDKBucketDeployment8693BB64968944B69AAFB0CC9EB8756C/Resource`
      ],
      [
        {id: "AwsSolutions-L1", reason: "Lambda function created implicitly by CDK."},
      ]
    );
    NagSuppressions.addResourceSuppressionsByPath(this,
      [
        `/${this.stackName}/ChatBotApi/RestApi/ChatBotApi/Default/v1/{proxy+}/OPTIONS/Resource`,
        `/${this.stackName}/ChatBotApi/RestApi/ChatBotApi/Default/v1/OPTIONS/Resource`,
        `/${this.stackName}/ChatBotApi/RestApi/ChatBotApi/Default/OPTIONS/Resource`
      ],
      [
        {id: "AwsSolutions-APIG4", reason: "OPTIONS method created implicitly. Explicitly configured methods are authorized."},
        {id: "AwsSolutions-COG4", reason: "OPTIONS method created implicitly. Explicitly configured methods are authorized."}
      ]
    );
    NagSuppressions.addResourceSuppressionsByPath(this,
      [
        `/${this.stackName}/ChatBotApi/WebSocketApi/WebSocketApi/$disconnect-Route/Resource`,
        `/${this.stackName}/ChatBotApi/WebSocketApi/WebSocketApi/$default-Route/Resource`,
      ],
      [
        {id: "AwsSolutions-APIG1", reason: "CDK does not provide an option to enable access logging for WebSocketApi construct."},
        {id: "AwsSolutions-APIG4", reason: "Connect authorizer not required for user usage."},
      ]
    );
    NagSuppressions.addResourceSuppressionsByPath(this,
      `/${this.stackName}/ChatBotApi/RestApi/ChatBotApi/DeploymentStage.api/Resource`,
      [
        {id: "AwsSolutions-APIG3", reason: "WAF not required due to configured Cognito auth."}
      ]
    );
    NagSuppressions.addResourceSuppressionsByPath(this,
      [
        `/${this.stackName}/Authentication/IdentityPool/AuthenticatedRole/DefaultPolicy/Resource`,
        `/${this.stackName}/Authentication/UserPool/smsRole/Resource`,
        `/${this.stackName}/Custom::CDKBucketDeployment8693BB64968944B69AAFB0CC9EB8756C/ServiceRole/DefaultPolicy/Resource`,
        `/${this.stackName}/LogRetentionaae0aa3c5b4d4f87b02d85b201efdd8a/ServiceRole/Resource`,
        `/${this.stackName}/LogRetentionaae0aa3c5b4d4f87b02d85b201efdd8a/ServiceRole/DefaultPolicy/Resource`,
        `/${this.stackName}/ChatBotApi/RestApi/ApiHandler/ServiceRole/Resource`,
        `/${this.stackName}/ChatBotApi/RestApi/ApiHandler/ServiceRole/DefaultPolicy/Resource`,
        `/${this.stackName}/ChatBotApi/RestApi/ChatBotApi/CloudWatchRole/Resource`,
        `/${this.stackName}/ChatBotApi/WebSocketApi/ConnectionHandlerFunction/ServiceRole/Resource`,
        `/${this.stackName}/ChatBotApi/WebSocketApi/ConnectionHandlerFunction/ServiceRole/DefaultPolicy/Resource`,
        `/${this.stackName}/ChatBotApi/WebSocketApi/AuthorizerFunction/ServiceRole/Resource`,
        `/${this.stackName}/ChatBotApi/WebSocketApi/AuthorizerFunction/ServiceRole/DefaultPolicy/Resource`,
        `/${this.stackName}/ChatBotApi/WebSocketApi/IncomingMessageHandlerFunction/ServiceRole/Resource`,
        `/${this.stackName}/ChatBotApi/WebSocketApi/IncomingMessageHandlerFunction/ServiceRole/DefaultPolicy/Resource`,
        `/${this.stackName}/ChatBotApi/WebSocketApi/OutgoingMessageFunction/ServiceRole/Resource`,
        `/${this.stackName}/ChatBotApi/WebSocketApi/OutgoingMessageFunction/ServiceRole/DefaultPolicy/Resource`,
        `/${this.stackName}/LangchainInterface/RequestHandler/ServiceRole/Resource`,
        `/${this.stackName}/LangchainInterface/RequestHandler/ServiceRole/DefaultPolicy/Resource`,
        `/${this.stackName}/Custom::CDKBucketDeployment8693BB64968944B69AAFB0CC9EB8756C/ServiceRole/Resource`,
      ],
      [
        {id: "AwsSolutions-IAM4", reason: "IAM role implicitly created by CDK."},
        {id: "AwsSolutions-IAM5", reason: "IAM role implicitly created by CDK."},
      ]
    );
    NagSuppressions.addResourceSuppressionsByPath(this,
      [
        `/${this.stackName}/ChatBotApi/ChatBuckets/LogsBucket/Policy/Resource`,
        `/${this.stackName}/UserInterface/WebsiteLogsBucket/Resource`,
        `/${this.stackName}/UserInterface/WebsiteLogsBucket/Policy/Resource`,
        `/${this.stackName}/UserInterface/DistributionLogsBucket/Resource`,
        `/${this.stackName}/ChatBotApi/ChatBuckets/FilesBucket/Policy/Resource`,
        `/${this.stackName}/UserInterface/WebsiteBucket/Policy/Resource`
      ],
      [
        {id: "AwsSolutions-S1", reason: "Logging bucket does not require it's own access logs."},
        {id: "AwsSolutions-S10", reason: "Logging bucket does not require SSL."}
      ]
    );
    // RAG configuration
    if (props.config.rag.enabled) {
      NagSuppressions.addResourceSuppressionsByPath(this,
        [
          `/${this.stackName}/RagEngines/SageMaker/Model/MultiAB24A/CodeBuildRole/DefaultPolicy/Resource`,
          `/${this.stackName}/RagEngines/SageMaker/Model/MultiAB24A/OnEventHandler/ServiceRole/Resource`,
          `/${this.stackName}/RagEngines/SageMaker/Model/MultiAB24A/IsCompleteHandler/ServiceRole/Resource`,
          `/${this.stackName}/RagEngines/SageMaker/Model/MultiAB24A/Provider/framework-onEvent/ServiceRole/Resource`,
          `/${this.stackName}/RagEngines/SageMaker/Model/MultiAB24A/Provider/framework-onEvent/ServiceRole/DefaultPolicy/Resource`,
          `/${this.stackName}/RagEngines/SageMaker/Model/MultiAB24A/Provider/framework-isComplete/ServiceRole/Resource`,
          `/${this.stackName}/RagEngines/SageMaker/Model/MultiAB24A/Provider/framework-isComplete/ServiceRole/DefaultPolicy/Resource`,
          `/${this.stackName}/RagEngines/SageMaker/Model/MultiAB24A/Provider/framework-onTimeout/ServiceRole/Resource`,
          `/${this.stackName}/RagEngines/SageMaker/Model/MultiAB24A/Provider/framework-onTimeout/ServiceRole/DefaultPolicy/Resource`,
          `/${this.stackName}/RagEngines/SageMaker/Model/MultiAB24A/Provider/waiter-state-machine/Role/DefaultPolicy/Resource`,
          `/${this.stackName}/RagEngines/SageMaker/Model/MultiAB24A/SageMakerExecutionRole/DefaultPolicy/Resource`,
          `/${this.stackName}/RagEngines/DataImport/FileImportBatchJob/FileImportJobRole/DefaultPolicy/Resource`,
          `/${this.stackName}/RagEngines/DataImport/FileImportBatchJob/FileImportContainer/ExecutionRole/DefaultPolicy/Resource`,
          `/${this.stackName}/RagEngines/DataImport/FileImportWorkflow/FileImportStateMachine/Role/DefaultPolicy/Resource`,
          `/${this.stackName}/RagEngines/DataImport/WebsiteCrawlingWorkflow/WebsiteParserFunction/ServiceRole/Resource`,
          `/${this.stackName}/RagEngines/DataImport/WebsiteCrawlingWorkflow/WebsiteParserFunction/ServiceRole/DefaultPolicy/Resource`,
          `/${this.stackName}/RagEngines/DataImport/WebsiteCrawlingWorkflow/WebsiteCrawling/Role/DefaultPolicy/Resource`,
          `/${this.stackName}/RagEngines/DataImport/UploadHandler/ServiceRole/Resource`,
          `/${this.stackName}/RagEngines/DataImport/UploadHandler/ServiceRole/DefaultPolicy/Resource`,
          `/${this.stackName}/RagEngines/Workspaces/DeleteWorkspace/DeleteWorkspaceFunction/ServiceRole/Resource`,
          `/${this.stackName}/RagEngines/Workspaces/DeleteWorkspace/DeleteWorkspaceFunction/ServiceRole/DefaultPolicy/Resource`,
          `/${this.stackName}/RagEngines/Workspaces/DeleteWorkspace/DeleteWorkspace/Role/DefaultPolicy/Resource`,
          `/${this.stackName}/RagEngines/DataImport/FileImportBatchJob/ManagedEc2EcsComputeEnvironment/InstanceProfileRole/Resource`,
          `/${this.stackName}/BucketNotificationsHandler050a0587b7544547bf325f094a3db834/Role/Resource`,
          `/${this.stackName}/BucketNotificationsHandler050a0587b7544547bf325f094a3db834/Role/DefaultPolicy/Resource`,
        ],
        [
          {id: "AwsSolutions-IAM4", reason: "IAM role implicitly created by CDK."},
          {id: "AwsSolutions-IAM5", reason: "IAM role implicitly created by CDK."},
        ]
      );
      NagSuppressions.addResourceSuppressionsByPath(this,
        [
          `/${this.stackName}/RagEngines/SageMaker/Model/MultiAB24A/LogsBucket/Policy/Resource`,
          `/${this.stackName}/RagEngines/SageMaker/Model/MultiAB24A/Bucket/Resource`,
          `/${this.stackName}/RagEngines/SageMaker/Model/MultiAB24A/Bucket/Policy/Resource`,
          `/${this.stackName}/RagEngines/DataImport/UploadLogsBucket/Policy/Resource`,
          `/${this.stackName}/RagEngines/DataImport/ProcessingLogsBucket/Policy/Resource`,
          `/${this.stackName}/RagEngines/KendraRetrieval/KendraDataBucket/Policy/Resource`,
          `/${this.stackName}/RagEngines/DataImport/UploadBucket/Policy/Resource`,
          `/${this.stackName}/RagEngines/DataImport/ProcessingBucket/Policy/Resource`,
        ],
        [
          {id: "AwsSolutions-S1", reason: "Logging bucket does not require it's own access logs."},
          {id: "AwsSolutions-S10", reason: "Logging bucket does not require SSL."}
        ]
      );

      if (props.config.rag.engines.aurora.enabled) {
        NagSuppressions.addResourceSuppressionsByPath(this,
          `/${this.stackName}/RagEngines/AuroraPgVector/AuroraDatabase/Secret/Resource`,
          [
            {id: "AwsSolutions-SMG4", reason: "Secret created implicitly by CDK."}
          ]
        );
        NagSuppressions.addResourceSuppressionsByPath(this,
          [
            `/${this.stackName}/RagEngines/AuroraPgVector/DatabaseSetupFunction/ServiceRole/Resource`,
            `/${this.stackName}/RagEngines/AuroraPgVector/DatabaseSetupProvider/framework-onEvent/ServiceRole/Resource`,
            `/${this.stackName}/RagEngines/AuroraPgVector/DatabaseSetupProvider/framework-onEvent/ServiceRole/DefaultPolicy/Resource`,
            `/${this.stackName}/RagEngines/AuroraPgVector/CreateAuroraWorkspace/CreateAuroraWorkspaceFunction/ServiceRole/Resource`,
            `/${this.stackName}/RagEngines/AuroraPgVector/CreateAuroraWorkspace/CreateAuroraWorkspaceFunction/ServiceRole/DefaultPolicy/Resource`,
            `/${this.stackName}/RagEngines/AuroraPgVector/CreateAuroraWorkspace/CreateAuroraWorkspace/Role/DefaultPolicy/Resource`,
          ],
          [
            {id: "AwsSolutions-IAM4", reason: "IAM role implicitly created by CDK."},
            {id: "AwsSolutions-IAM5", reason: "IAM role implicitly created by CDK."},
          ]
        );
      }
      if (props.config.rag.engines.opensearch.enabled) {
        NagSuppressions.addResourceSuppressionsByPath(this,
          [
            `/${this.stackName}/RagEngines/OpenSearchVector/CreateAuroraWorkspace/CreateOpenSearchWorkspaceFunction/ServiceRole/Resource`,
            `/${this.stackName}/RagEngines/OpenSearchVector/CreateAuroraWorkspace/CreateOpenSearchWorkspaceFunction/ServiceRole/DefaultPolicy/Resource`,
            `/${this.stackName}/RagEngines/OpenSearchVector/CreateAuroraWorkspace/CreateOpenSearchWorkspace/Role/DefaultPolicy/Resource`,
          ],
          [
            {id: "AwsSolutions-IAM4", reason: "IAM role implicitly created by CDK."},
            {id: "AwsSolutions-IAM5", reason: "IAM role implicitly created by CDK."},
          ]
        );
      }
      if (props.config.rag.engines.kendra.enabled) {
        NagSuppressions.addResourceSuppressionsByPath(this,
          [
            `/${this.stackName}/RagEngines/KendraRetrieval/LogsBucket/Resource`,
            `/${this.stackName}/RagEngines/KendraRetrieval/LogsBucket/Policy/Resource`,
          ],
          [
            {id: "AwsSolutions-S10", reason: "S3 Bucket implicitly created by CDK."},
          ]
        );
        NagSuppressions.addResourceSuppressionsByPath(this,
          [
            `/${this.stackName}/RagEngines/KendraRetrieval/CreateAuroraWorkspace/CreateKendraWorkspace/Role/DefaultPolicy/Resource`,
            `/${this.stackName}/RagEngines/KendraRetrieval/KendraRole/DefaultPolicy/Resource`,
          ],
          [
            {id: "AwsSolutions-IAM4", reason: "IAM role implicitly created by CDK."},
            {id: "AwsSolutions-IAM5", reason: "IAM role implicitly created by CDK."},
          ]
        );
      }
    }
    // Implicitly created resources with changing paths
    NagSuppressions.addStackSuppressions(this,
      [
        {id: "CdkNagValidationFailure", reason: "Intrinstic function references."},
      ]
    );
  }
}
