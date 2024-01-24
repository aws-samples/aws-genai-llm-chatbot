import * as path from "path";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { SystemConfig } from "../../shared/types";
import { Shared } from "../../shared";
import { RagDynamoDBTables } from "../rag-dynamodb-tables";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as tasks from "aws-cdk-lib/aws-stepfunctions-tasks";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as rds from "aws-cdk-lib/aws-rds";
import { RemovalPolicy } from "aws-cdk-lib";

export interface CreateAuroraWorkspaceProps {
  readonly config: SystemConfig;
  readonly shared: Shared;
  readonly ragDynamoDBTables: RagDynamoDBTables;
  readonly dbCluster: rds.DatabaseCluster;
}

export class CreateAuroraWorkspace extends Construct {
  public readonly stateMachine: sfn.StateMachine;

  constructor(scope: Construct, id: string, props: CreateAuroraWorkspaceProps) {
    super(scope, id);

    const createFunction = new lambda.Function(
      this,
      "CreateAuroraWorkspaceFunction",
      {
        vpc: props.shared.vpc,
        code: props.shared.sharedCode.bundleWithLambdaAsset(
          path.join(__dirname, "./functions/create-workflow/create")
        ),
        runtime: props.shared.pythonRuntime,
        architecture: props.shared.lambdaArchitecture,
        handler: "index.lambda_handler",
        layers: [props.shared.powerToolsLayer, props.shared.commonLayer],
        timeout: cdk.Duration.minutes(5),
        logRetention: logs.RetentionDays.ONE_WEEK,
        environment: {
          ...props.shared.defaultEnvironmentVariables,
          AURORA_DB_SECRET_ID: props.dbCluster.secret?.secretArn as string,
          WORKSPACES_TABLE_NAME:
            props.ragDynamoDBTables.workspacesTable.tableName,
          WORKSPACES_BY_OBJECT_TYPE_INDEX_NAME:
            props.ragDynamoDBTables.workspacesByObjectTypeIndexName,
        },
      }
    );

    props.dbCluster.secret?.grantRead(createFunction);
    props.dbCluster.connections.allowDefaultPortFrom(createFunction);
    props.ragDynamoDBTables.workspacesTable.grantReadWriteData(createFunction);

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
        cause: "Workspace creation failed",
      })
    );

    const setCreating = new tasks.DynamoUpdateItem(this, "SetCreating", {
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
        ":statusValue": tasks.DynamoAttributeValue.fromString("creating"),
      },
      resultPath: sfn.JsonPath.DISCARD,
    });

    const setReady = new tasks.DynamoUpdateItem(this, "SetReady", {
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
        ":statusValue": tasks.DynamoAttributeValue.fromString("ready"),
      },
      resultPath: sfn.JsonPath.DISCARD,
    });

    const createTask = new tasks.LambdaInvoke(this, "Create", {
      lambdaFunction: createFunction,
      resultPath: "$.createResult",
    }).addCatch(handleError, {
      errors: ["States.ALL"],
      resultPath: "$.createResult",
    });

    const workflow = setCreating
      .next(createTask)
      .next(setReady)
      .next(new sfn.Succeed(this, "Success"));

    const logGroup = new logs.LogGroup(
      this,
      "CreateAuroraWorkspaceSMLogGroup",
      {
        removalPolicy: RemovalPolicy.DESTROY,
      }
    );

    const stateMachine = new sfn.StateMachine(this, "CreateAuroraWorkspace", {
      definitionBody: sfn.DefinitionBody.fromChainable(workflow),
      timeout: cdk.Duration.minutes(5),
      comment: "Create Aurora Workspace Workflow",
      tracingEnabled: true,
      logs: {
        destination: logGroup,
        level: sfn.LogLevel.ALL,
      },
    });

    this.stateMachine = stateMachine;
  }
}
