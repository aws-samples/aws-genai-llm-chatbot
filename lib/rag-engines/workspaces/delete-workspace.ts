import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as tasks from "aws-cdk-lib/aws-stepfunctions-tasks";
import { Construct } from "constructs";
import * as path from "path";
import { Shared } from "../../shared";
import { SystemConfig } from "../../shared/types";
import { AuroraPgVector } from "../aurora-pgvector";
import { DataImport } from "../data-import";
import { KendraRetrieval } from "../kendra-retrieval";
import { OpenSearchVector } from "../opensearch-vector";
import { RagDynamoDBTables } from "../rag-dynamodb-tables";
import { RemovalPolicy } from "aws-cdk-lib";

export interface DeleteWorkspaceProps {
  readonly config: SystemConfig;
  readonly shared: Shared;
  readonly dataImport: DataImport;
  readonly ragDynamoDBTables: RagDynamoDBTables;
  readonly auroraPgVector?: AuroraPgVector;
  readonly openSearchVector?: OpenSearchVector;
  readonly kendraRetrieval?: KendraRetrieval;
}

export class DeleteWorkspace extends Construct {
  public readonly stateMachine?: sfn.StateMachine;

  constructor(scope: Construct, id: string, props: DeleteWorkspaceProps) {
    super(scope, id);

    const deleteFunction = new lambda.Function(
      this,
      "DeleteWorkspaceFunction",
      {
        vpc: props.shared.vpc,
        code: props.shared.sharedCode.bundleWithLambdaAsset(
          path.join(__dirname, "./functions/delete-workspace-workflow/delete")
        ),
        runtime: props.shared.pythonRuntime,
        architecture: props.shared.lambdaArchitecture,
        handler: "index.lambda_handler",
        layers: [props.shared.powerToolsLayer, props.shared.commonLayer],
        timeout: cdk.Duration.minutes(15),
        logRetention: logs.RetentionDays.ONE_WEEK,
        environment: {
          ...props.shared.defaultEnvironmentVariables,
          AURORA_DB_SECRET_ID: props.auroraPgVector?.database.secret
            ?.secretArn as string,
          UPLOAD_BUCKET_NAME: props.dataImport.uploadBucket.bucketName,
          PROCESSING_BUCKET_NAME: props.dataImport.processingBucket.bucketName,
          WORKSPACES_TABLE_NAME:
            props.ragDynamoDBTables.workspacesTable.tableName,
          WORKSPACES_BY_OBJECT_TYPE_INDEX_NAME:
            props.ragDynamoDBTables.workspacesByObjectTypeIndexName,
          DOCUMENTS_TABLE_NAME:
            props.ragDynamoDBTables?.documentsTable.tableName ?? "",
          DOCUMENTS_BY_COMPOUND_KEY_INDEX_NAME:
            props.ragDynamoDBTables?.documentsByCompoundKeyIndexName ?? "",
          DOCUMENTS_BY_STATUS_INDEX:
            props.ragDynamoDBTables.documentsByStatusIndexName ?? "",
          DEFAULT_KENDRA_S3_DATA_SOURCE_BUCKET_NAME:
            props.kendraRetrieval?.kendraS3DataSourceBucket?.bucketName ?? "",
          OPEN_SEARCH_COLLECTION_ENDPOINT:
            props.openSearchVector?.openSearchCollectionEndpoint ?? "",
        },
      }
    );

    if (props.auroraPgVector) {
      props.auroraPgVector.database.secret?.grantRead(deleteFunction);
      props.auroraPgVector.database.connections.allowDefaultPortFrom(
        deleteFunction
      );
    }

    if (props.openSearchVector) {
      deleteFunction.addToRolePolicy(
        new iam.PolicyStatement({
          actions: [
            "aoss:APIAccessAll",
            "aoss:DescribeIndex",
            "aoss:DeleteIndex",
          ],
          resources: [props.openSearchVector.openSearchCollection.attrArn],
        })
      );

      props.openSearchVector.addToAccessPolicy(
        "delete-workspace",
        [deleteFunction.role?.roleArn],
        [
          "aoss:DeleteIndex",
          "aoss:DescribeIndex",
          "aoss:ReadDocument",
          "aoss:WriteDocument",
        ]
      );
    }

    props.dataImport.uploadBucket.grantReadWrite(deleteFunction);
    props.dataImport.processingBucket.grantReadWrite(deleteFunction);
    props.kendraRetrieval?.kendraS3DataSourceBucket?.grantReadWrite(
      deleteFunction
    );
    props.ragDynamoDBTables.workspacesTable.grantReadWriteData(deleteFunction);
    props.ragDynamoDBTables.documentsTable.grantReadWriteData(deleteFunction);

    const handleError = new tasks.DynamoUpdateItem(this, "HandleError", {
      table: props.ragDynamoDBTables.workspacesTable,
      key: {
        workspace_id: tasks.DynamoAttributeValue.fromString(
          sfn.JsonPath.stringAt("$.workspace_id")
        ),
        object_type: tasks.DynamoAttributeValue.fromString("workspace"),
      },
      updateExpression: "set #status = :error",
      expressionAttributeNames: {
        "#status": "status",
      },
      expressionAttributeValues: {
        ":error": tasks.DynamoAttributeValue.fromString("error"),
      },
    }).next(
      new sfn.Fail(this, "Fail", {
        cause: "Workspace deletion failed",
      })
    );

    const setDeleting = new tasks.DynamoUpdateItem(this, "SetDeleting", {
      table: props.ragDynamoDBTables.workspacesTable,
      key: {
        workspace_id: tasks.DynamoAttributeValue.fromString(
          sfn.JsonPath.stringAt("$.workspace_id")
        ),
        object_type: tasks.DynamoAttributeValue.fromString("workspace"),
      },
      updateExpression: "set #status=:statusValue",
      expressionAttributeNames: {
        "#status": "status",
      },
      expressionAttributeValues: {
        ":statusValue": tasks.DynamoAttributeValue.fromString("deleting"),
      },
      resultPath: sfn.JsonPath.DISCARD,
    });

    const deleteTask = new tasks.LambdaInvoke(this, "Delete", {
      lambdaFunction: deleteFunction,
      resultPath: "$.deleteResult",
    }).addCatch(handleError, {
      errors: ["States.ALL"],
      resultPath: "$.deleteResult",
    });

    const workflow = setDeleting
      .next(deleteTask)
      .next(new sfn.Succeed(this, "Success"));

    const logGroup = new logs.LogGroup(this, "DeleteWorkspaceSMLogGroup", {
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const stateMachine = new sfn.StateMachine(this, "DeleteWorkspace", {
      definitionBody: sfn.DefinitionBody.fromChainable(workflow),
      timeout: cdk.Duration.minutes(5),
      comment: "Delete Workspace Workflow",
      tracingEnabled: true,
      logs: {
        destination: logGroup,
        level: sfn.LogLevel.ALL,
      },
    });

    this.stateMachine = stateMachine;
  }
}
