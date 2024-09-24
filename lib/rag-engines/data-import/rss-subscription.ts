import { Construct } from "constructs";
import { SystemConfig } from "../../shared/types";
import { Shared } from "../../shared";
import { RagDynamoDBTables } from "../rag-dynamodb-tables";
import * as path from "path";
import * as cdk from "aws-cdk-lib";
import * as logs from "aws-cdk-lib/aws-logs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as s3 from "aws-cdk-lib/aws-s3";

export interface RssSubscriptionProperties {
  readonly config: SystemConfig;
  readonly shared: Shared;
  readonly processingBucket: s3.Bucket;
  readonly ragDynamoDBTables: RagDynamoDBTables;
  readonly websiteCrawlerStateMachine: sfn.StateMachine;
}

export class RssSubscription extends Construct {
  public readonly rssIngestorFunction: lambda.Function;
  constructor(scope: Construct, id: string, props: RssSubscriptionProperties) {
    super(scope, id);

    this.rssIngestorFunction = new lambda.Function(this, "RssIngestor", {
      code: props.shared.sharedCode.bundleWithLambdaAsset(
        path.join(__dirname, "./functions/rss-ingestor")
      ),
      description:
        "Retrieves the latest data from the RSS Feed and adds any newly found posts to be queued for Website Crawling",
      architecture: props.shared.lambdaArchitecture,
      runtime: props.shared.pythonRuntime,
      tracing: props.config.advancedMonitoring
        ? lambda.Tracing.ACTIVE
        : lambda.Tracing.DISABLED,
      memorySize: 1024,
      handler: "index.lambda_handler",
      layers: [props.shared.powerToolsLayer, props.shared.commonLayer],
      timeout: cdk.Duration.minutes(15),
      logRetention: props.config.logRetention ?? logs.RetentionDays.ONE_WEEK,
      loggingFormat: lambda.LoggingFormat.JSON,
      environment: {
        ...props.shared.defaultEnvironmentVariables,
        CONFIG_PARAMETER_NAME: props.shared.configParameter.parameterName,
        WORKSPACES_TABLE_NAME:
          props.ragDynamoDBTables.workspacesTable.tableName,
        WORKSPACES_BY_OBJECT_TYPE_INDEX_NAME:
          props.ragDynamoDBTables.workspacesByObjectTypeIndexName,
        DOCUMENTS_TABLE_NAME:
          props.ragDynamoDBTables.documentsTable.tableName ?? "",
        DOCUMENTS_BY_COMPOUND_KEY_INDEX_NAME:
          props.ragDynamoDBTables.documentsByCompoundKeyIndexName ?? "",
        DOCUMENTS_BY_STATUS_INDEX:
          props.ragDynamoDBTables.documentsByStatusIndexName ?? "",
      },
    });

    props.shared.configParameter.grantRead(this.rssIngestorFunction);
    props.ragDynamoDBTables.documentsTable.grantReadWriteData(
      this.rssIngestorFunction
    );
    props.ragDynamoDBTables.workspacesTable.grantReadData(
      this.rssIngestorFunction
    );

    const triggerRssIngestorsFunction = new lambda.Function(
      this,
      "triggerRssIngestorsFunction",
      {
        code: props.shared.sharedCode.bundleWithLambdaAsset(
          path.join(__dirname, "./functions/trigger-rss-ingestors")
        ),
        description: "Invokes RSS Feed Ingestors for each Subscribed RSS Feed",
        architecture: props.shared.lambdaArchitecture,
        runtime: props.shared.pythonRuntime,
        tracing: props.config.advancedMonitoring
          ? lambda.Tracing.ACTIVE
          : lambda.Tracing.DISABLED,
        memorySize: 1024,
        handler: "index.lambda_handler",
        layers: [props.shared.powerToolsLayer, props.shared.commonLayer],
        timeout: cdk.Duration.seconds(15),
        logRetention: props.config.logRetention ?? logs.RetentionDays.ONE_WEEK,
        loggingFormat: lambda.LoggingFormat.JSON,
        environment: {
          ...props.shared.defaultEnvironmentVariables,
          CONFIG_PARAMETER_NAME: props.shared.configParameter.parameterName,
          WORKSPACES_TABLE_NAME:
            props.ragDynamoDBTables.workspacesTable.tableName,
          WORKSPACES_BY_OBJECT_TYPE_INDEX_NAME:
            props.ragDynamoDBTables.workspacesByObjectTypeIndexName,
          DOCUMENTS_TABLE_NAME:
            props.ragDynamoDBTables.documentsTable.tableName ?? "",
          DOCUMENTS_BY_COMPOUND_KEY_INDEX_NAME:
            props.ragDynamoDBTables.documentsByCompoundKeyIndexName ?? "",
          DOCUMENTS_BY_STATUS_INDEX:
            props.ragDynamoDBTables.documentsByStatusIndexName ?? "",
          PROCESSING_BUCKET_NAME: props.processingBucket.bucketName,
          RSS_FEED_INGESTOR_FUNCTION: this.rssIngestorFunction.functionName,
        },
      }
    );

    this.rssIngestorFunction.grantInvoke(triggerRssIngestorsFunction);
    this.rssIngestorFunction.grantInvoke(triggerRssIngestorsFunction);
    props.shared.configParameter.grantRead(triggerRssIngestorsFunction);

    props.ragDynamoDBTables.documentsTable.grantReadData(
      triggerRssIngestorsFunction
    );

    new events.Rule(this, "triggerRssIngestorsFunctionSchedule", {
      schedule: events.Schedule.rate(cdk.Duration.minutes(15)),
      targets: [new targets.LambdaFunction(triggerRssIngestorsFunction)],
    });

    const crawlQueuedRssPostsFunction = new lambda.Function(
      this,
      "crawlQueuedRssPostsFunction",
      {
        vpc: props.shared.vpc,
        description:
          "Functions polls the RSS items for pending urls and invokes Website crawler inference. Max of 10 URLs per invoke.",
        code: props.shared.sharedCode.bundleWithLambdaAsset(
          path.join(__dirname, "./functions/batch-crawl-rss-posts")
        ),
        architecture: props.shared.lambdaArchitecture,
        runtime: props.shared.pythonRuntime,
        tracing: props.config.advancedMonitoring
          ? lambda.Tracing.ACTIVE
          : lambda.Tracing.DISABLED,
        memorySize: 1024,
        handler: "index.lambda_handler",
        layers: [props.shared.powerToolsLayer, props.shared.commonLayer],
        timeout: cdk.Duration.minutes(5),
        logRetention: props.config.logRetention ?? logs.RetentionDays.ONE_WEEK,
        loggingFormat: lambda.LoggingFormat.JSON,
        environment: {
          ...props.shared.defaultEnvironmentVariables,
          CONFIG_PARAMETER_NAME: props.shared.configParameter.parameterName,
          WORKSPACES_TABLE_NAME:
            props.ragDynamoDBTables.workspacesTable.tableName,
          WORKSPACES_BY_OBJECT_TYPE_INDEX_NAME:
            props.ragDynamoDBTables.workspacesByObjectTypeIndexName,
          DOCUMENTS_TABLE_NAME:
            props.ragDynamoDBTables.documentsTable.tableName ?? "",
          DOCUMENTS_BY_COMPOUND_KEY_INDEX_NAME:
            props.ragDynamoDBTables.documentsByCompoundKeyIndexName ?? "",
          DOCUMENTS_BY_STATUS_INDEX:
            props.ragDynamoDBTables.documentsByStatusIndexName ?? "",
          WEBSITE_CRAWLING_WORKFLOW_ARN:
            props.websiteCrawlerStateMachine.stateMachineArn,
          PROCESSING_BUCKET_NAME: props.processingBucket.bucketName,
        },
      }
    );

    props.processingBucket.grantReadWrite(crawlQueuedRssPostsFunction);
    props.websiteCrawlerStateMachine.grantStartExecution(
      crawlQueuedRssPostsFunction
    );
    new events.Rule(this, "CrawlQueuedRssPostsScheduleRule", {
      schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
      targets: [new targets.LambdaFunction(crawlQueuedRssPostsFunction)],
    });

    props.shared.configParameter.grantRead(crawlQueuedRssPostsFunction);
    props.ragDynamoDBTables.documentsTable.grantReadWriteData(
      crawlQueuedRssPostsFunction
    );
    props.ragDynamoDBTables.workspacesTable.grantReadWriteData(
      crawlQueuedRssPostsFunction
    );
  }
}
