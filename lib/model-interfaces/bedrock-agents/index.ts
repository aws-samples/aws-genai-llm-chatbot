import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";
import * as logs from "aws-cdk-lib/aws-logs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as sns from "aws-cdk-lib/aws-sns";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import * as path from "path";
import { Shared } from "../../shared";
import { SystemConfig } from "../../shared/types";

interface BedrockAgentsInterfaceProps {
  readonly shared: Shared;
  readonly config: SystemConfig;
  readonly messagesTopic: sns.Topic;
  readonly sessionsTable: dynamodb.Table;
  readonly byUserIdIndex: string;
  readonly chatbotFilesBucket: s3.Bucket;
}

export class BedrockAgentsInterface extends Construct {
  public readonly ingestionQueue: sqs.Queue;
  public readonly requestHandler: lambda.Function;

  constructor(
    scope: Construct,
    id: string,
    props: BedrockAgentsInterfaceProps
  ) {
    super(scope, id);

    const ingestionQueue = new sqs.Queue(this, "IngestionQueue", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      visibilityTimeout: cdk.Duration.minutes(16),
      deadLetterQueue: {
        maxReceiveCount: 3,
        queue: new sqs.Queue(this, "IngestionDLQ", {
          removalPolicy: cdk.RemovalPolicy.DESTROY,
        }),
      },
    });

    const requestHandler = new lambda.Function(this, "RequestHandler", {
      vpc: props.shared.vpc,
      code: props.shared.sharedCode.bundleWithLambdaAsset(
        path.join(__dirname, "./functions/request-handler")
      ),
      handler: "index.handler",
      runtime: lambda.Runtime.PYTHON_3_11,
      architecture: props.shared.lambdaArchitecture,
      timeout: cdk.Duration.minutes(15),
      logRetention: logs.RetentionDays.ONE_WEEK,
      layers: [props.shared.powerToolsLayer, props.shared.commonLayer],
      environment: {
        ...props.shared.defaultEnvironmentVariables,
        SESSIONS_TABLE_NAME: props.sessionsTable.tableName,
        SESSIONS_BY_USER_ID_INDEX_NAME: props.byUserIdIndex,
        CHATBOT_FILES_BUCKET_NAME: props.chatbotFilesBucket.bucketName,
        MESSAGES_TOPIC_ARN: props.messagesTopic.topicArn,
      },
    });

    requestHandler.addEventSource(
      new lambdaEventSources.SqsEventSource(ingestionQueue, {
        batchSize: 1,
        maxBatchingWindow: cdk.Duration.seconds(5),
        reportBatchItemFailures: true,
      })
    );

    props.sessionsTable.grantReadWriteData(requestHandler);
    props.chatbotFilesBucket.grantRead(requestHandler);
    props.messagesTopic.grantPublish(requestHandler);

    requestHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "bedrock-agentcore:InvokeAgentRuntime",
          "bedrock-agentcore:ListAgentRuntimes",
        ],
        resources: [
          `arn:${cdk.Aws.PARTITION}:bedrock-agentcore:*:${cdk.Aws.ACCOUNT_ID}:runtime/*`,
        ],
      })
    );

    this.ingestionQueue = ingestionQueue;
    this.requestHandler = requestHandler;
  }
}
