import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { SystemConfig } from "../../shared/types";
import { Shared } from "../../shared";
import { WebCrawlerBatchJob } from "./web-crawler-batch-job";
import { RagDynamoDBTables } from "../rag-dynamodb-tables";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as iam from "aws-cdk-lib/aws-iam";
import * as tasks from "aws-cdk-lib/aws-stepfunctions-tasks";
import * as logs from "aws-cdk-lib/aws-logs";

export interface WebsiteCrawlingWorkflowProps {
  readonly config: SystemConfig;
  readonly shared: Shared;
  readonly webCrawlerBatchJob: WebCrawlerBatchJob;
  readonly ragDynamoDBTables: RagDynamoDBTables;
}

export class WebsiteCrawlingWorkflow extends Construct {
  public readonly stateMachine: sfn.StateMachine;

  constructor(
    scope: Construct,
    id: string,
    props: WebsiteCrawlingWorkflowProps
  ) {
    super(scope, id);

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
        cause: "Crawler failed",
      })
    );
    const webCrawlerJob = new sfn.CustomState(this, "WebCrawlerJob", {
      stateJson: {
        Type: "Task",
        Resource: `arn:${cdk.Aws.PARTITION}:states:::batch:submitJob.sync`,
        Parameters: {
          JobDefinition:
            props.webCrawlerBatchJob.fileImportJob.jobDefinitionArn,
          "JobName.$":
            "States.Format('WebCrawler-{}-{}', $.workspace_id, $.document_id)",
          JobQueue: props.webCrawlerBatchJob.jobQueue.jobQueueArn,
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
                "Value.$": "$.bucket_name",
              },
              {
                Name: "INPUT_OBJECT_KEY",
                "Value.$": "$.object_key",
              },
            ],
          },
        },
        ResultPath: "$.job",
      },
    }).addCatch(handleError, {
      errors: ["States.ALL"],
      resultPath: "$.job",
    });
    const logGroup = new logs.LogGroup(this, "WebsiteCrawlingSMLogGroup", {
      removalPolicy:
        props.config.retainOnDelete === true
          ? cdk.RemovalPolicy.RETAIN_ON_UPDATE_OR_DELETE
          : cdk.RemovalPolicy.DESTROY,
      retention: props.config.logRetention,
      // Log group name should start with `/aws/vendedlogs/` to not exceed Cloudwatch Logs Resource Policy
      // size limit.
      // https://docs.aws.amazon.com/step-functions/latest/dg/bp-cwl.html
      logGroupName: `/aws/vendedlogs/states/WebsiteCrawling-${this.node.addr}`,
    });

    const workflow = setProcessing.next(webCrawlerJob).next(setProcessed);
    const stateMachine = new sfn.StateMachine(this, "WebsiteCrawling", {
      definitionBody: sfn.DefinitionBody.fromChainable(workflow),
      comment: "Website Crawling Workflow",
      tracingEnabled: true,
      logs: {
        destination: logGroup,
        level: sfn.LogLevel.ALL,
      },
    });

    if (props.shared.kmsKey) {
      props.shared.kmsKey.grantEncryptDecrypt(stateMachine.role);
    }

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
          props.webCrawlerBatchJob.jobQueue.jobQueueArn,
          props.webCrawlerBatchJob.fileImportJob.jobDefinitionArn,
        ],
      })
    );

    this.stateMachine = stateMachine;
  }
}
