import * as path from "path";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { SystemConfig } from "../../shared/types";
import { Shared } from "../../shared";
import { RagDynamoDBTables } from "../rag-dynamodb-tables";
import { OpenSearchVector } from "../opensearch-vector";
import { KendraRetrieval } from "../kendra-retrieval";
import { AuroraPgVector } from "../aurora-pgvector";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as tasks from "aws-cdk-lib/aws-stepfunctions-tasks";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";

export interface DeleteWorkspaceProps {
  readonly config: SystemConfig;
  readonly shared: Shared;
  readonly ragDynamoDBTables: RagDynamoDBTables;
  readonly auroraPgVector?: AuroraPgVector;
  readonly openSearch?: OpenSearchVector;
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
        code: lambda.Code.fromAsset(
          path.join(__dirname, "./functions/delete-workspace-workflow/delete")
        ),
        runtime: props.shared.pythonRuntime,
        architecture: props.shared.lambdaArchitecture,
        handler: "index.lambda_handler",
        layers: [
          props.shared.powerToolsLayer,
          props.shared.commonLayer.layer,
          props.shared.pythonSDKLayer,
        ],
        timeout: cdk.Duration.minutes(5),
        logRetention: logs.RetentionDays.ONE_WEEK,
        environment: {
          ...props.shared.defaultEnvironmentVariables,
          AURORA_DB_SECRET_ID: props.auroraPgVector?.database.secret
            ?.secretArn as string,
          WORKSPACES_TABLE_NAME:
            props.ragDynamoDBTables.workspacesTable.tableName,
          WORKSPACES_BY_OBJECT_TYPE_INDEX_NAME:
            props.ragDynamoDBTables.workspacesByObjectTypeIndexName,
        },
      }
    );

    if (props.auroraPgVector) {
      props.auroraPgVector.database.secret?.grantRead(deleteFunction);
      props.auroraPgVector.database.connections.allowDefaultPortFrom(
        deleteFunction
      );
    }

    props.ragDynamoDBTables.workspacesTable.grantReadWriteData(deleteFunction);

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

    const stateMachine = new sfn.StateMachine(this, "DeleteWorkspace", {
      definitionBody: sfn.DefinitionBody.fromChainable(workflow),
      timeout: cdk.Duration.minutes(5),
      comment: "Delete Workspace Workflow",
    });

    this.stateMachine = stateMachine;
  }
}
