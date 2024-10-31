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
import { AURORA_DB_USERS } from ".";

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
        description: "Creates Aurora workspace",
        runtime: props.shared.pythonRuntime,
        architecture: props.shared.lambdaArchitecture,
        handler: "index.lambda_handler",
        layers: [props.shared.powerToolsLayer, props.shared.commonLayer],
        timeout: cdk.Duration.minutes(5),
        logRetention: props.config.logRetention ?? logs.RetentionDays.ONE_WEEK,
        loggingFormat: lambda.LoggingFormat.JSON,
        environment: {
          ...props.shared.defaultEnvironmentVariables,
          AURORA_DB_USER: AURORA_DB_USERS.ADMIN,
          AURORA_DB_HOST: props.dbCluster?.clusterEndpoint?.hostname ?? "",
          AURORA_DB_PORT: props.dbCluster?.clusterEndpoint?.port + "",
          WORKSPACES_TABLE_NAME:
            props.ragDynamoDBTables.workspacesTable.tableName,
          WORKSPACES_BY_OBJECT_TYPE_INDEX_NAME:
            props.ragDynamoDBTables.workspacesByObjectTypeIndexName,
        },
      }
    );

    // Process will create a new table and requires Admin permission on the SQL Schema
    props.dbCluster.grantConnect(createFunction, AURORA_DB_USERS.ADMIN);
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
        removalPolicy:
          props.config.retainOnDelete === true
            ? cdk.RemovalPolicy.RETAIN_ON_UPDATE_OR_DELETE
            : cdk.RemovalPolicy.DESTROY,
        retention: props.config.logRetention,
        // Log group name should start with `/aws/vendedlogs/` to not exceed Cloudwatch Logs Resource Policy
        // size limit.
        // https://docs.aws.amazon.com/step-functions/latest/dg/bp-cwl.html
        logGroupName: `/aws/vendedlogs/states/CreateAuroraWorkspace-${this.node.addr}`,
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
    if (props.shared.kmsKey) {
      props.shared.kmsKey.grantEncryptDecrypt(stateMachine.role);
    }

    this.stateMachine = stateMachine;
  }
}
