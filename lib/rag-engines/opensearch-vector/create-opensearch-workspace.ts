import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as oss from "aws-cdk-lib/aws-opensearchserverless";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as tasks from "aws-cdk-lib/aws-stepfunctions-tasks";
import { Construct } from "constructs";
import * as path from "path";
import { Shared } from "../../shared";
import { SystemConfig } from "../../shared/types";
import { RagDynamoDBTables } from "../rag-dynamodb-tables";

export interface CreateOpenSearchWorkspaceProps {
  readonly config: SystemConfig;
  readonly shared: Shared;
  readonly ragDynamoDBTables: RagDynamoDBTables;
  readonly openSearchCollectionName: string;
  readonly openSearchCollection: oss.CfnCollection;
  readonly collectionEndpoint: string;
}

export class CreateOpenSearchWorkspace extends Construct {
  public readonly stateMachine: sfn.StateMachine;
  public readonly createWorkspaceRole?: iam.IRole;

  constructor(
    scope: Construct,
    id: string,
    props: CreateOpenSearchWorkspaceProps
  ) {
    super(scope, id);

    const createFunction = new lambda.Function(
      this,
      "CreateOpenSearchWorkspaceFunction",
      {
        vpc: props.shared.vpc,
        code: props.shared.sharedCode.bundleWithLambdaAsset(
          path.join(__dirname, "./functions/create-workflow/create")
        ),
        description: "Creates the Open Search workspace",
        runtime: props.shared.pythonRuntime,
        architecture: props.shared.lambdaArchitecture,
        handler: "index.lambda_handler",
        layers: [props.shared.powerToolsLayer, props.shared.commonLayer],
        timeout: cdk.Duration.minutes(5),
        logRetention: props.config.logRetention ?? logs.RetentionDays.ONE_WEEK,
        loggingFormat: lambda.LoggingFormat.JSON,
        environment: {
          ...props.shared.defaultEnvironmentVariables,
          WORKSPACES_TABLE_NAME:
            props.ragDynamoDBTables.workspacesTable.tableName,
          WORKSPACES_BY_OBJECT_TYPE_INDEX_NAME:
            props.ragDynamoDBTables.workspacesByObjectTypeIndexName,
          OPEN_SEARCH_COLLECTION_NAME: props.openSearchCollectionName,
          OPEN_SEARCH_COLLECTION_ENDPOINT: props.collectionEndpoint,
          OPEN_SEARCH_COLLECTION_ENDPOINT_PORT: "443",
        },
      }
    );

    props.ragDynamoDBTables.workspacesTable.grantReadWriteData(createFunction);
    createFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "aoss:APIAccessAll",
          "aoss:DescribeIndex",
          "aoss:CreateIndex",
        ],
        resources: [props.openSearchCollection.attrArn],
      })
    );

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
      "CreateOpenSearchWorkspaceSMLogGroup",
      {
        removalPolicy:
          props.config.retainOnDelete === true
            ? cdk.RemovalPolicy.RETAIN_ON_UPDATE_OR_DELETE
            : cdk.RemovalPolicy.DESTROY,
        retention: props.config.logRetention,
        // Log group name should start with `/aws/vendedlogs/` to not exceed Cloudwatch Logs Resource Policy
        // size limit.
        // https://docs.aws.amazon.com/step-functions/latest/dg/bp-cwl.html
        logGroupName: `/aws/vendedlogs/states/CreateOpenSearchWorkspace-${this.node.addr}`,
      }
    );

    const stateMachine = new sfn.StateMachine(
      this,
      "CreateOpenSearchWorkspace",
      {
        definitionBody: sfn.DefinitionBody.fromChainable(workflow),
        timeout: cdk.Duration.minutes(5),
        comment: "Create OpenSearch Workspace Workflow",
        tracingEnabled: true,
        logs: {
          destination: logGroup,
          level: sfn.LogLevel.ALL,
        },
      }
    );
    if (props.shared.kmsKey) {
      props.shared.kmsKey.grantEncryptDecrypt(stateMachine.role);
    }

    this.stateMachine = stateMachine;
    this.createWorkspaceRole = createFunction.role;
  }
}
