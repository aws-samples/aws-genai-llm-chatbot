import * as path from "path";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { SystemConfig } from "../../shared/types";
import { Shared } from "../../shared";
import { FileImportBatchJob } from "./file-import-batch-job";
import { RagDynamoDBTables } from "../rag-dynamodb-tables";
import { FileImportWorkflow } from "./file-import-workflow";
import { WebsiteCrawlingWorkflow } from "./website-crawling-workflow";
import { RssSubscription } from "./rss-subscription";
import { OpenSearchVector } from "../opensearch-vector";
import { KendraRetrieval } from "../kendra-retrieval";
import { SageMakerRagModels } from "../sagemaker-rag-models";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3Notifications from "aws-cdk-lib/aws-s3-notifications";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";
import * as rds from "aws-cdk-lib/aws-rds";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import { NagSuppressions } from "cdk-nag";
import { WebCrawlerBatchJob } from "./web-crawler-batch-job";

export interface DataImportProps {
  readonly config: SystemConfig;
  readonly shared: Shared;
  readonly auroraDatabase?: rds.DatabaseCluster;
  readonly ragDynamoDBTables: RagDynamoDBTables;
  readonly openSearchVector?: OpenSearchVector;
  readonly kendraRetrieval?: KendraRetrieval;
  readonly sageMakerRagModels?: SageMakerRagModels;
  readonly workspacesTable: dynamodb.Table;
  readonly documentsTable: dynamodb.Table;
  readonly workspacesByObjectTypeIndexName: string;
  readonly documentsByCompoundKeyIndexName: string;
}

export class DataImport extends Construct {
  public readonly uploadBucket: s3.Bucket;
  public readonly processingBucket: s3.Bucket;
  public readonly ingestionQueue: sqs.Queue;
  public readonly fileImportWorkflow: sfn.StateMachine;
  public readonly websiteCrawlingWorkflow: sfn.StateMachine;
  public readonly rssIngestorFunction: lambda.Function;
  constructor(scope: Construct, id: string, props: DataImportProps) {
    super(scope, id);

    const ingestionDeadLetterQueue = new sqs.Queue(
      this,
      "IngestionDeadLetterQueue",
      {
        visibilityTimeout: cdk.Duration.seconds(900),
        enforceSSL: true,
        encryption: props.shared.queueKmsKey
          ? sqs.QueueEncryption.KMS
          : undefined,
        encryptionMasterKey: props.shared.queueKmsKey,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }
    );

    const ingestionQueue = new sqs.Queue(this, "IngestionQueue", {
      encryption: props.shared.queueKmsKey
        ? sqs.QueueEncryption.KMS
        : undefined,
      encryptionMasterKey: props.shared.queueKmsKey,
      visibilityTimeout: cdk.Duration.seconds(900),
      enforceSSL: true,
      deadLetterQueue: {
        queue: ingestionDeadLetterQueue,
        maxReceiveCount: 3,
      },
    });

    const uploadLogsBucket = new s3.Bucket(this, "UploadLogsBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy:
        props.config.retainOnDelete === true
          ? cdk.RemovalPolicy.RETAIN_ON_UPDATE_OR_DELETE
          : cdk.RemovalPolicy.DESTROY,
      encryption: s3.BucketEncryption.S3_MANAGED,
      autoDeleteObjects: props.config.retainOnDelete !== true,
      enforceSSL: true,
      versioned: true,
    });

    const uploadBucket = new s3.Bucket(this, "UploadBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy:
        props.config.retainOnDelete === true
          ? cdk.RemovalPolicy.RETAIN_ON_UPDATE_OR_DELETE
          : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: props.config.retainOnDelete !== true,
      transferAcceleration: true,
      enforceSSL: true,
      serverAccessLogsBucket: uploadLogsBucket,
      encryption: props.shared.kmsKey
        ? s3.BucketEncryption.KMS
        : s3.BucketEncryption.S3_MANAGED,
      encryptionKey: props.shared.kmsKey,
      versioned: true,
      cors: [
        {
          allowedHeaders: ["*"],
          allowedMethods: [
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
            s3.HttpMethods.GET,
            s3.HttpMethods.HEAD,
          ],
          allowedOrigins: ["*"],
          exposedHeaders: ["ETag"],
          maxAge: 3000,
        },
      ],
    });

    const processingLogsBucket = new s3.Bucket(this, "ProcessingLogsBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy:
        props.config.retainOnDelete === true
          ? cdk.RemovalPolicy.RETAIN_ON_UPDATE_OR_DELETE
          : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: props.config.retainOnDelete !== true,
      enforceSSL: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
    });

    const processingBucket = new s3.Bucket(this, "ProcessingBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy:
        props.config.retainOnDelete === true
          ? cdk.RemovalPolicy.RETAIN_ON_UPDATE_OR_DELETE
          : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: props.config.retainOnDelete !== true,
      enforceSSL: true,
      serverAccessLogsBucket: processingLogsBucket,
      encryption: props.shared.kmsKey
        ? s3.BucketEncryption.KMS
        : s3.BucketEncryption.S3_MANAGED,
      encryptionKey: props.shared.kmsKey,
      versioned: true,
    });

    uploadBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3Notifications.SqsDestination(ingestionQueue)
    );

    uploadBucket.addEventNotification(
      s3.EventType.OBJECT_REMOVED,
      new s3Notifications.SqsDestination(ingestionQueue)
    );

    const fileImportBatchJob = new FileImportBatchJob(
      this,
      "FileImportBatchJob",
      {
        shared: props.shared,
        config: props.config,
        uploadBucket,
        processingBucket,
        auroraDatabase: props.auroraDatabase,
        ragDynamoDBTables: props.ragDynamoDBTables,
        sageMakerRagModelsEndpoint: props.sageMakerRagModels?.model?.endpoint,
        openSearchVector: props.openSearchVector,
      }
    );

    const fileImportWorkflow = new FileImportWorkflow(
      this,
      "FileImportWorkflow",
      {
        shared: props.shared,
        config: props.config,
        fileImportBatchJob,
        ragDynamoDBTables: props.ragDynamoDBTables,
      }
    );

    const webCrawlerBatchJob = new WebCrawlerBatchJob(
      this,
      "WebCrawlerBatchJob",
      {
        shared: props.shared,
        config: props.config,
        uploadBucket,
        processingBucket,
        auroraDatabase: props.auroraDatabase,
        ragDynamoDBTables: props.ragDynamoDBTables,
        sageMakerRagModelsEndpoint: props.sageMakerRagModels?.model?.endpoint,
        openSearchVector: props.openSearchVector,
      }
    );

    const websiteCrawlingWorkflow = new WebsiteCrawlingWorkflow(
      this,
      "WebsiteCrawlingWorkflow",
      {
        shared: props.shared,
        config: props.config,
        webCrawlerBatchJob,
        ragDynamoDBTables: props.ragDynamoDBTables,
      }
    );

    const rssSubscription = new RssSubscription(this, "RssSubscription", {
      shared: props.shared,
      config: props.config,
      processingBucket: processingBucket,
      ragDynamoDBTables: props.ragDynamoDBTables,
      websiteCrawlerStateMachine: websiteCrawlingWorkflow.stateMachine,
    });

    const uploadHandler = new lambda.Function(this, "UploadHandler", {
      code: props.shared.sharedCode.bundleWithLambdaAsset(
        path.join(__dirname, "./functions/upload-handler")
      ),
      handler: "index.lambda_handler",
      description: "Data Import upload handler",
      runtime: props.shared.pythonRuntime,
      architecture: props.shared.lambdaArchitecture,
      timeout: cdk.Duration.minutes(15),
      memorySize: 512,
      tracing: props.config.advancedMonitoring
        ? lambda.Tracing.ACTIVE
        : lambda.Tracing.DISABLED,
      logRetention: props.config.logRetention ?? logs.RetentionDays.ONE_WEEK,
      loggingFormat: lambda.LoggingFormat.JSON,
      layers: [props.shared.powerToolsLayer, props.shared.commonLayer],
      vpc: props.shared.vpc,
      vpcSubnets: props.shared.vpc.privateSubnets as ec2.SubnetSelection,
      environment: {
        ...props.shared.defaultEnvironmentVariables,
        CONFIG_PARAMETER_NAME: props.shared.configParameter.parameterName,
        API_KEYS_SECRETS_ARN: props.shared.apiKeysSecret.secretArn,
        PROCESSING_BUCKET_NAME: processingBucket.bucketName,
        UPLOAD_BUCKET_NAME: uploadBucket.bucketName,
        WORKSPACES_TABLE_NAME: props.workspacesTable?.tableName ?? "",
        WORKSPACES_BY_OBJECT_TYPE_INDEX_NAME:
          props.workspacesByObjectTypeIndexName ?? "",
        DOCUMENTS_TABLE_NAME: props.documentsTable.tableName ?? "",
        DOCUMENTS_BY_COMPOUND_KEY_INDEX_NAME:
          props.documentsByCompoundKeyIndexName ?? "",
        SAGEMAKER_RAG_MODELS_ENDPOINT:
          props.sageMakerRagModels?.model?.endpoint.attrEndpointName ?? "",
        FILE_IMPORT_WORKFLOW_ARN:
          fileImportWorkflow?.stateMachine.stateMachineArn ?? "",
        DEFAULT_KENDRA_S3_DATA_SOURCE_BUCKET_NAME:
          props.kendraRetrieval?.kendraS3DataSourceBucket?.bucketName ?? "",
      },
    });

    uploadBucket.grantReadWrite(uploadHandler);
    processingBucket.grantReadWrite(uploadHandler);
    props.shared.apiKeysSecret.grantRead(uploadHandler);
    props.shared.configParameter.grantRead(uploadHandler);
    props.workspacesTable.grantReadWriteData(uploadHandler);
    props.documentsTable.grantReadWriteData(uploadHandler);
    props.kendraRetrieval?.kendraS3DataSourceBucket?.grantReadWrite(
      uploadHandler
    );

    ingestionQueue.grantConsumeMessages(uploadHandler);
    fileImportWorkflow.stateMachine.grantStartExecution(uploadHandler);

    if (props.config.bedrock?.roleArn) {
      uploadHandler.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ["sts:AssumeRole"],
          resources: [props.config.bedrock.roleArn],
        })
      );
    }

    uploadHandler.addEventSource(
      new lambdaEventSources.SqsEventSource(ingestionQueue)
    );

    this.uploadBucket = uploadBucket;
    this.processingBucket = processingBucket;
    this.ingestionQueue = ingestionQueue;
    this.fileImportWorkflow = fileImportWorkflow.stateMachine;
    this.websiteCrawlingWorkflow = websiteCrawlingWorkflow.stateMachine;
    this.rssIngestorFunction = rssSubscription.rssIngestorFunction;

    /**
     * CDK NAG suppression
     */
    NagSuppressions.addResourceSuppressions(
      [uploadLogsBucket, processingLogsBucket],
      [
        {
          id: "AwsSolutions-S1",
          reason: "Logging bucket does not require it's own access logs.",
        },
      ]
    );
  }
}
