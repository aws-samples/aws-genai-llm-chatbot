import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";
import * as logs from "aws-cdk-lib/aws-logs";

import * as sns from "aws-cdk-lib/aws-sns";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import * as path from "path";
import { Shared } from "../../shared";
import { Direction, ModelInterface, SystemConfig } from "../../shared/types";
import { SqsSubscription } from "aws-cdk-lib/aws-sns-subscriptions";

interface BedrockAgentInterfaceProps {
  readonly shared: Shared;
  readonly config: SystemConfig;
  readonly messagesTopic: sns.Topic;
  readonly sessionsTable: dynamodb.Table;
  readonly byUserIdIndex: string;
}

export class BedrockAgentInterface extends Construct {
  public readonly ingestionQueue: sqs.Queue;
  public readonly requestHandler: lambda.Function;

  constructor(scope: Construct, id: string, props: BedrockAgentInterfaceProps) {
    super(scope, id);

    const requestHandler = new lambda.Function(this, "RequestHandler", {
      vpc: props.shared.vpc,
      code: props.shared.sharedCode.bundleWithLambdaAsset(
        path.join(__dirname, "./functions/request-handler")
      ),
      handler: "index.handler",
      runtime: props.shared.pythonRuntime,
      architecture: props.shared.lambdaArchitecture,
      tracing: lambda.Tracing.ACTIVE,
      timeout: cdk.Duration.minutes(15),
      memorySize: 1024,
      logRetention: props.config.logRetention ?? logs.RetentionDays.ONE_WEEK,
      loggingFormat: lambda.LoggingFormat.JSON,
      layers: [props.shared.powerToolsLayer, props.shared.commonLayer],
      environment: {
        ...props.shared.defaultEnvironmentVariables,
        CONFIG_PARAMETER_NAME: props.shared.configParameter.parameterName,
        SESSIONS_TABLE_NAME: props.sessionsTable.tableName,
        SESSIONS_BY_USER_ID_INDEX_NAME: props.byUserIdIndex,
        MESSAGES_TOPIC_ARN: props.messagesTopic.topicArn,
      },
    });

    props.sessionsTable.grantReadWriteData(requestHandler);
    props.messagesTopic.grantPublish(requestHandler);
    props.shared.apiKeysSecret.grantRead(requestHandler);
    props.shared.configParameter.grantRead(requestHandler);

    requestHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["bedrock:InvokeAgent", "bedrock:GetAgentAlias"],
        resources: ["*"],
      })
    );

    if (props.config.bedrock?.roleArn) {
      requestHandler.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ["sts:AssumeRole"],
          resources: [props.config.bedrock.roleArn],
        })
      );
    }

    const deadLetterQueue = new sqs.Queue(this, "DLQ", { enforceSSL: true });
    const queue = new sqs.Queue(this, "Queue", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      // https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html#events-sqs-queueconfig
      visibilityTimeout: cdk.Duration.minutes(15 * 6),
      enforceSSL: true,
      deadLetterQueue: {
        queue: deadLetterQueue,
        maxReceiveCount: 3,
      },
    });

    queue.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ["sqs:SendMessage"],
        resources: [queue.queueArn],
        principals: [
          new iam.ServicePrincipal("events.amazonaws.com"),
          new iam.ServicePrincipal("sqs.amazonaws.com"),
        ],
      })
    );

    props.messagesTopic.addSubscription(
      new SqsSubscription(queue, {
        filterPolicyWithMessageBody: {
          direction: sns.FilterOrPolicy.filter(
            sns.SubscriptionFilter.stringFilter({
              allowlist: [Direction.In],
            })
          ),
          modelInterface: sns.FilterOrPolicy.filter(
            sns.SubscriptionFilter.stringFilter({
              allowlist: [ModelInterface.BedrockAgent],
            })
          ),
        },
      })
    );

    requestHandler.addEventSource(new lambdaEventSources.SqsEventSource(queue));

    this.ingestionQueue = queue;
    this.requestHandler = requestHandler;
  }
}
