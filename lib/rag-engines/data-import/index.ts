import * as path from "path";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { SystemConfig } from "../../shared/types";
import { Shared } from "../../shared";
import { FileImportBatchJob } from "./file-import-batch-job";
import { RagDynamoDBTables } from "../rag-dynamodb-tables";
import { FileImportWorkflow } from "./file-import-workflow";
import { WebsiteCrawlingWorkflow } from "./website-crawling-workflow";
import { OpenSearchVector } from "../opensearch-vector";
import { KendraRetrieval } from "../kendra-retrieval";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as sagemaker from "aws-cdk-lib/aws-sagemaker";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3Notifications from "aws-cdk-lib/aws-s3-notifications";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";
import * as rds from "aws-cdk-lib/aws-rds";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";

export interface DataImportProps {
  readonly config: SystemConfig;
  readonly shared: Shared;
  readonly auroraDatabase?: rds.DatabaseCluster;
  readonly ragDynamoDBTables: RagDynamoDBTables;
  readonly openSearchVector?: OpenSearchVector;
  readonly kendraRetrieval?: KendraRetrieval;
  readonly sageMakerRagModelsEndpoint?: sagemaker.CfnEndpoint;
  readonly workspacesTable: dynamodb.Table;
  readonly documentsTable: dynamodb.Table;
  readonly workspacesByObjectTypeIndexName: string;
  readonly documentsByCompountKeyIndexName: string;
}

export class DataImport extends Construct {
  public readonly uploadBucket: s3.Bucket;
  public readonly processingBucket: s3.Bucket;
  public readonly ingestionQueue: sqs.Queue;
  public readonly fileImportWorkflow: sfn.StateMachine;
  public readonly websiteCrawlingWorkflow: sfn.StateMachine;

  constructor(scope: Construct, id: string, props: DataImportProps) {
    super(scope, id);

    const ingestionDealLetterQueue = new sqs.Queue(
      this,
      "IngestionDeadLetterQueue",
      {
        visibilityTimeout: cdk.Duration.seconds(900),
      }
    );

    const ingestionQueue = new sqs.Queue(this, "IngestionQueue", {
      visibilityTimeout: cdk.Duration.seconds(900),
      deadLetterQueue: {
        queue: ingestionDealLetterQueue,
        maxReceiveCount: 3,
      },
    });

    const uploadBucket = new s3.Bucket(this, "UploadBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      transferAcceleration: true,
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

    const processingBucket = new s3.Bucket(this, "ProcessingBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
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
        sageMakerRagModelsEndpoint: props.sageMakerRagModelsEndpoint,
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

    const websiteCrawlingWorkflow = new WebsiteCrawlingWorkflow(
      this,
      "WebsiteCrawlingWorkflow",
      {
        shared: props.shared,
        config: props.config,
        processingBucket,
        auroraDatabase: props.auroraDatabase,
        ragDynamoDBTables: props.ragDynamoDBTables,
        sageMakerRagModelsEndpoint: props.sageMakerRagModelsEndpoint,
        openSearchVector: props.openSearchVector,
      }
    );

    const uploadHandler = new lambda.Function(this, "UploadHandler", {
      code: lambda.Code.fromAsset(
        path.join(__dirname, "./functions/upload-handler")
      ),
      handler: "index.lambda_handler",
      runtime: props.shared.pythonRuntime,
      architecture: props.shared.lambdaArchitecture,
      timeout: cdk.Duration.minutes(15),
      memorySize: 512,
      tracing: lambda.Tracing.ACTIVE,
      logRetention: logs.RetentionDays.ONE_WEEK,
      layers: [
        props.shared.powerToolsLayer,
        props.shared.commonLayer,
        props.shared.pythonSDKLayer,
      ],
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
          props.documentsByCompountKeyIndexName ?? "",
        SAGEMAKER_RAG_MODELS_ENDPOINT:
          props.sageMakerRagModelsEndpoint?.attrEndpointName ?? "",
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
  }
}
