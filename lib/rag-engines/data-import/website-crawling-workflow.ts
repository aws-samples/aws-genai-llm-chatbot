import * as path from "path";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { SystemConfig } from "../../shared/types";
import { Shared } from "../../shared";
import { RagDynamoDBTables } from "../rag-dynamodb-tables";
import { OpenSearchVector } from "../opensearch-vector";
import * as rds from "aws-cdk-lib/aws-rds";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as sagemaker from "aws-cdk-lib/aws-sagemaker";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as tasks from "aws-cdk-lib/aws-stepfunctions-tasks";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";

export interface WebsiteCrawlingWorkflowProps {
  readonly config: SystemConfig;
  readonly shared: Shared;
  readonly ragDynamoDBTables: RagDynamoDBTables;
  readonly auroraDatabase?: rds.DatabaseCluster;
  readonly processingBucket: s3.Bucket;
  readonly sageMakerRagModelsEndpoint?: sagemaker.CfnEndpoint;
  readonly openSearchVector?: OpenSearchVector;
}

export class WebsiteCrawlingWorkflow extends Construct {
  public readonly stateMachine: sfn.StateMachine;

  constructor(
    scope: Construct,
    id: string,
    props: WebsiteCrawlingWorkflowProps
  ) {
    super(scope, id);

    const websiteParserFunction = new lambda.Function(
      this,
      "WebsiteParserFunction",
      {
        vpc: props.shared.vpc,
        code: lambda.Code.fromAsset(
          path.join(
            __dirname,
            "./functions/website-crawling-workflow/website-parser"
          )
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
        timeout: cdk.Duration.minutes(15),
        logRetention: logs.RetentionDays.ONE_WEEK,
        environment: {
          ...props.shared.defaultEnvironmentVariables,
          CONFIG_PARAMETER_NAME: props.shared.configParameter.parameterName,
          API_KEYS_SECRETS_ARN: props.shared.apiKeysSecret.secretArn,
          AURORA_DB_SECRET_ID: props.auroraDatabase?.secret
            ?.secretArn as string,
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
      }
    );

    props.shared.configParameter.grantRead(websiteParserFunction);
    props.shared.apiKeysSecret.grantRead(websiteParserFunction);
    props.processingBucket.grantReadWrite(websiteParserFunction);
    props.ragDynamoDBTables.workspacesTable.grantReadWriteData(
      websiteParserFunction
    );
    props.ragDynamoDBTables.documentsTable.grantReadWriteData(
      websiteParserFunction
    );

    if (props.auroraDatabase) {
      props.auroraDatabase.secret?.grantRead(websiteParserFunction);
      props.auroraDatabase.connections.allowDefaultPortFrom(
        websiteParserFunction
      );
    }

    if (props.openSearchVector) {
      websiteParserFunction.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ["aoss:APIAccessAll"],
          resources: [props.openSearchVector.openSearchCollection.attrArn],
        })
      );

      props.openSearchVector.addToAccessPolicy(
        "website-crawling-workflow",
        [websiteParserFunction.role?.roleArn],
        ["aoss:DescribeIndex", "aoss:ReadDocument", "aoss:WriteDocument"]
      );

      props.openSearchVector.createOpenSearchWorkspaceWorkflow.grantStartExecution(
        websiteParserFunction
      );
    }

    if (props.sageMakerRagModelsEndpoint) {
      websiteParserFunction.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ["sagemaker:InvokeEndpoint"],
          resources: [props.sageMakerRagModelsEndpoint.ref],
        })
      );
    }

    if (props.config.bedrock?.enabled) {
      websiteParserFunction.addToRolePolicy(
        new iam.PolicyStatement({
          actions: [
            "bedrock:InvokeModel",
            "bedrock:InvokeModelWithResponseStream",
          ],
          resources: ["*"],
        })
      );

      if (props.config.bedrock?.roleArn) {
        websiteParserFunction.addToRolePolicy(
          new iam.PolicyStatement({
            actions: ["sts:AssumeRole"],
            resources: [props.config.bedrock.roleArn],
          })
        );
      }
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

    const workflow = setProcessing
      .next(
        new tasks.LambdaInvoke(this, "WebsiteParser", {
          lambdaFunction: websiteParserFunction,
          resultPath: "$.parsingResult",
        }).addCatch(handleError, {
          errors: ["States.ALL"],
          resultPath: "$.parsingResult",
        })
      )
      .next(setProcessed);

    const stateMachine = new sfn.StateMachine(this, "WebsiteCrawling", {
      definitionBody: sfn.DefinitionBody.fromChainable(workflow),
      timeout: cdk.Duration.minutes(120),
      comment: "Website crawling workflow",
    });

    stateMachine.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["events:CreateRule", "events:PutRule", "events:PutTargets"],
        resources: ["*"],
      })
    );

    this.stateMachine = stateMachine;
  }
}
