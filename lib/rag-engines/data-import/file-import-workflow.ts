import * as path from "path";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { SystemConfig } from "../../shared/types";
import { Shared } from "../../shared";
import { BatchJobs } from "./batch-jobs";
import { RagDynamoDBTables } from "../rag-dynamodb-tables";
import { OpenSearchVector } from "../opensearch-vector";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as iam from "aws-cdk-lib/aws-iam";
import * as tasks from "aws-cdk-lib/aws-stepfunctions-tasks";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as rds from "aws-cdk-lib/aws-rds";
import * as logs from "aws-cdk-lib/aws-logs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as sagemaker from "aws-cdk-lib/aws-sagemaker";

export interface FileImportWorkflowProps {
  readonly config: SystemConfig;
  readonly shared: Shared;
  readonly batchJobs: BatchJobs;
  readonly ragDynamoDBTables: RagDynamoDBTables;
  readonly auroraDatabase?: rds.DatabaseCluster;
  readonly processingBucket: s3.Bucket;
  readonly sageMakerRagModelsEndpoint?: sagemaker.CfnEndpoint;
  readonly openSearchVector?: OpenSearchVector;
}

export class FileImportWorkflow extends Construct {
  public readonly stateMachine: sfn.StateMachine;

  constructor(scope: Construct, id: string, props: FileImportWorkflowProps) {
    super(scope, id);

    const dataImportFunction = new lambda.Function(this, "DataImportFunction", {
      vpc: props.shared.vpc,
      code: lambda.Code.fromAsset(
        path.join(__dirname, "./functions/file-import-workflow/data-import")
      ),
      runtime: props.shared.pythonRuntime,
      architecture: props.shared.lambdaArchitecture,
      memorySize: 1024,
      handler: "index.lambda_handler",
      layers: [
        props.shared.powerToolsLayer,
        props.shared.commonLayer.layer,
        props.shared.pythonSDKLayer,
      ],
      timeout: cdk.Duration.minutes(10),
      logRetention: logs.RetentionDays.ONE_WEEK,
      environment: {
        ...props.shared.defaultEnvironmentVariables,
        CONFIG_PARAMETER_NAME: props.shared.configParameter.parameterName,
        API_KEYS_SECRETS_ARN: props.shared.apiKeysSecret.secretArn,
        AURORA_DB_SECRET_ID: props.auroraDatabase?.secret?.secretArn as string,
        PROCESSING_BUCKET_NAME: props.processingBucket.bucketName,
        WORKSPACES_TABLE_NAME:
          props.ragDynamoDBTables.workspacesTable.tableName,
        WORKSPACES_BY_OBJECT_TYPE_INDEX_NAME:
          props.ragDynamoDBTables.workspacesByObjectTypeIndexName,
        DOCUMENTS_TABLE_NAME:
          props.ragDynamoDBTables.documentsTable.tableName ?? "",
        DOCUMENTS_BY_COMPOUND_KEY_INDEX_NAME:
          props.ragDynamoDBTables.documentsByCompountKeyIndexName ?? "",
        SAGEMAKER_RAG_MODELS_ENDPOINT:
          props.sageMakerRagModelsEndpoint?.attrEndpointName ?? "",
        OPEN_SEARCH_COLLECTION_ENDPOINT:
          props.openSearchVector?.openSearchCollectionEndpoint ?? "",
      },
    });

    props.shared.configParameter.grantRead(dataImportFunction);
    props.shared.apiKeysSecret.grantRead(dataImportFunction);
    props.processingBucket.grantReadWrite(dataImportFunction);
    props.ragDynamoDBTables.workspacesTable.grantReadWriteData(
      dataImportFunction
    );
    props.ragDynamoDBTables.documentsTable.grantReadWriteData(
      dataImportFunction
    );

    if (props.auroraDatabase) {
      props.auroraDatabase.secret?.grantRead(dataImportFunction);
      props.auroraDatabase.connections.allowDefaultPortFrom(dataImportFunction);
    }

    if (props.openSearchVector) {
      dataImportFunction.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ["aoss:APIAccessAll"],
          resources: [props.openSearchVector.openSearchCollection.attrArn],
        })
      );

      props.openSearchVector.addToAccessPolicy(
        "file-import-workflow",
        [dataImportFunction.role?.roleArn],
        ["aoss:DescribeIndex", "aoss:ReadDocument", "aoss:WriteDocument"]
      );

      props.openSearchVector.createOpenSearchWorkspaceWorkflow.grantStartExecution(
        dataImportFunction
      );
    }

    if (props.sageMakerRagModelsEndpoint) {
      dataImportFunction.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ["sagemaker:InvokeEndpoint"],
          resources: [props.sageMakerRagModelsEndpoint.ref],
        })
      );
    }

    if (props.config.bedrock?.roleArn) {
      dataImportFunction.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ["sts:AssumeRole"],
          resources: [props.config.bedrock.roleArn],
        })
      );
    }

    const handleError = new tasks.DynamoUpdateItem(this, "HandleError", {
      table: props.ragDynamoDBTables.documentsTable,
      key: {
        workspace_id: tasks.DynamoAttributeValue.fromString(
          sfn.JsonPath.stringAt("$.workspace_id")
        ),
        document_id: tasks.DynamoAttributeValue.fromString(
          sfn.JsonPath.stringAt("$.document_id")
        ),
      },
      updateExpression: "set #status = :error",
      expressionAttributeNames: {
        "#status": "status",
      },
      expressionAttributeValues: {
        ":error": tasks.DynamoAttributeValue.fromString("error"),
      },
    });

    handleError.next(
      new sfn.Fail(this, "Fail", {
        cause: "Import failed",
      })
    );

    const setProcessing = new tasks.DynamoUpdateItem(this, "SetProcessing", {
      table: props.ragDynamoDBTables.documentsTable,
      key: {
        workspace_id: tasks.DynamoAttributeValue.fromString(
          sfn.JsonPath.stringAt("$.workspace_id")
        ),
        document_id: tasks.DynamoAttributeValue.fromString(
          sfn.JsonPath.stringAt("$.document_id")
        ),
      },
      updateExpression: "set #status=:statusValue",
      expressionAttributeNames: {
        "#status": "status",
      },
      expressionAttributeValues: {
        ":statusValue": tasks.DynamoAttributeValue.fromString("processing"),
      },
      resultPath: sfn.JsonPath.DISCARD,
    });

    const setProcessed = new tasks.DynamoUpdateItem(this, "SetProcessed", {
      table: props.ragDynamoDBTables.documentsTable,
      key: {
        workspace_id: tasks.DynamoAttributeValue.fromString(
          sfn.JsonPath.stringAt("$.workspace_id")
        ),
        document_id: tasks.DynamoAttributeValue.fromString(
          sfn.JsonPath.stringAt("$.document_id")
        ),
      },
      updateExpression: "set #status=:statusValue",
      expressionAttributeNames: {
        "#status": "status",
      },
      expressionAttributeValues: {
        ":statusValue": tasks.DynamoAttributeValue.fromString("processed"),
      },
      resultPath: sfn.JsonPath.DISCARD,
    }).next(new sfn.Succeed(this, "Success"));

    const convertFile = new sfn.CustomState(this, "ConvertFile", {
      stateJson: {
        Type: "Task",
        Resource: "arn:aws:states:::batch:submitJob.sync",
        Parameters: {
          JobDefinition: props.batchJobs.fileConverterJob.jobDefinitionArn,
          "JobName.$":
            "States.Format('FileImport-{}-{}', $.workspace_id, $.document_id)",
          JobQueue: props.batchJobs.jobQueue.jobQueueArn,
          ContainerOverrides: {
            Environment: [
              {
                Name: "WORKSPACE_ID",
                "Value.$": "$.workspace_id",
              },
              {
                Name: "DOCUMENT_ID",
                "Value.$": "$.document_id",
              },
              {
                Name: "INPUT_BUCKET_NAME",
                "Value.$": "$.input_bucket_name",
              },
              {
                Name: "INPUT_OBJECT_KEY",
                "Value.$": "$.input_object_key",
              },
              {
                Name: "PROCESSING_BUCKET_NAME",
                "Value.$": "$.processing_bucket_name",
              },
              {
                Name: "PROCESSING_OBJECT_KEY",
                "Value.$": "$.processing_object_key",
              },
            ],
          },
        },
        ResultPath: "$.job",
        Catch: [
          {
            ErrorEquals: ["States.ALL"],
            Next: handleError.id,
          },
        ],
      },
    });

    const dataImport = new tasks.LambdaInvoke(this, "DataImport", {
      lambdaFunction: dataImportFunction,
      resultPath: "$.importResult",
    })
      .addCatch(handleError, {
        errors: ["States.ALL"],
        resultPath: "$.importResult",
      })
      .next(setProcessed);

    const workflow = setProcessing.next(
      new sfn.Choice(this, "ConvertToText?")
        .when(
          sfn.Condition.booleanEquals("$.convert_to_text", true),
          convertFile.next(dataImport)
        )
        .otherwise(dataImport)
    );

    const stateMachine = new sfn.StateMachine(this, "FileImport", {
      definitionBody: sfn.DefinitionBody.fromChainable(workflow),
      timeout: cdk.Duration.hours(4),
      comment: "File import workflow",
    });

    stateMachine.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["events:CreateRule", "events:PutRule", "events:PutTargets"],
        resources: ["*"],
      })
    );

    stateMachine.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["batch:SubmitJob"],
        resources: [
          props.batchJobs.jobQueue.jobQueueArn,
          props.batchJobs.fileConverterJob.jobDefinitionArn,
        ],
      })
    );

    this.stateMachine = stateMachine;
  }
}
