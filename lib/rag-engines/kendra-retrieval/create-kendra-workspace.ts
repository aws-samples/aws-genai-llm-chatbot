import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { SystemConfig } from "../../shared/types";
import { Shared } from "../../shared";
import { RagDynamoDBTables } from "../rag-dynamodb-tables";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as tasks from "aws-cdk-lib/aws-stepfunctions-tasks";
import * as logs from "aws-cdk-lib/aws-logs";

export interface CreateKendraWorkspaceProps {
  readonly config: SystemConfig;
  readonly shared: Shared;
  readonly ragDynamoDBTables: RagDynamoDBTables;
}

export class CreateKendraWorkspace extends Construct {
  public readonly stateMachine: sfn.StateMachine;

  constructor(scope: Construct, id: string, props: CreateKendraWorkspaceProps) {
    super(scope, id);

    new tasks.DynamoUpdateItem(this, "HandleError", {
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

    const workflow = setCreating
      .next(setReady)
      .next(new sfn.Succeed(this, "Success"));

    const logGroup = new logs.LogGroup(
      this,
      "CreateKendraWorkspaceSMLogGroup",
      {
        removalPolicy:
          props.config.retainOnDelete === true
            ? cdk.RemovalPolicy.RETAIN_ON_UPDATE_OR_DELETE
            : cdk.RemovalPolicy.DESTROY,
        retention: props.config.logRetention,
        // Log group name should start with `/aws/vendedlogs/` to not exceed Cloudwatch Logs Resource Policy
        // size limit.
        // https://docs.aws.amazon.com/step-functions/latest/dg/bp-cwl.html
        logGroupName: `/aws/vendedlogs/states/CreateKendraWorkspace-${this.node.addr}`,
      }
    );

    const stateMachine = new sfn.StateMachine(this, "CreateKendraWorkspace", {
      definitionBody: sfn.DefinitionBody.fromChainable(workflow),
      timeout: cdk.Duration.minutes(5),
      comment: "Create Kendra Workspace Workflow",
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
