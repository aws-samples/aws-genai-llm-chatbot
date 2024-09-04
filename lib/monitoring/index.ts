import { Stack } from "aws-cdk-lib";
import { IGraphqlApi } from "aws-cdk-lib/aws-appsync";
import {
  LogQueryWidget,
  MathExpression,
  Metric,
} from "aws-cdk-lib/aws-cloudwatch";
import { ITable } from "aws-cdk-lib/aws-dynamodb";
import { IFunction as ILambdaFunction } from "aws-cdk-lib/aws-lambda";
import { CfnCollection } from "aws-cdk-lib/aws-opensearchserverless";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { IStateMachine } from "aws-cdk-lib/aws-stepfunctions";
import {
  AxisPosition,
  MonitoringFacade,
  SingleWidgetDashboardSegment,
} from "cdk-monitoring-constructs";
import { Construct } from "constructs";
import { CfnIndex } from "aws-cdk-lib/aws-kendra";
import { IDatabaseCluster } from "aws-cdk-lib/aws-rds";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { FilterPattern, ILogGroup, MetricFilter } from "aws-cdk-lib/aws-logs";

export interface MonitoringProps {
  prefix: string;
  advancedMonitoring: boolean;
  appsycnApi: IGraphqlApi;
  appsyncResolversLogGroups: ILogGroup[];
  llmRequestHandlersLogGroups: ILogGroup[];
  cognito: { userPoolId: string; clientId: string };
  tables: ITable[];
  buckets: Bucket[];
  sqs: Queue[];
  ragFunctionProcessing: ILambdaFunction[];
  ragStateMachineProcessing: IStateMachine[];
  aurora?: IDatabaseCluster;
  opensearch?: CfnCollection;
  kendra?: CfnIndex;
}

export class Monitoring extends Construct {
  constructor(
    private scope: Construct,
    id: string,
    props: MonitoringProps
  ) {
    super(scope, id);

    const monitoring = new MonitoringFacade(
      this,
      props.prefix + "GenAI-Chatbot-Dashboard",
      {}
    );

    const region = Stack.of(scope).region;

    monitoring.addLargeHeader("APIs").monitorAppSyncApi({
      api: props.appsycnApi,
      alarmFriendlyName: "AppSync",
    });

    monitoring.addSegment(
      new SingleWidgetDashboardSegment(
        this.getLogsWidget("Resolvers Logs:", props.appsyncResolversLogGroups, [
          "identify.claims.sub as cognito_user",
          "correlation_id",
        ])
      )
    );
    monitoring.addSegment(
      new SingleWidgetDashboardSegment(
        this.getLogsWidget(
          "LLM Request Handlers Logs:",
          props.llmRequestHandlersLogGroups,
          []
        )
      )
    );

    if (props.advancedMonitoring) {
      this.addMetricFilter(
        props.prefix + "GenAI",
        monitoring,
        props.llmRequestHandlersLogGroups
      );
    }

    const link = `https://${region}.console.aws.amazon.com/cognito/v2/idp/user-pools/${props.cognito.userPoolId}/users?region=${region}`;
    const title = `Cognito [**UserPool**](${link})`;
    this.addCognitoMetrics(
      monitoring,
      props.cognito.userPoolId,
      props.cognito.clientId,
      title
    );
    monitoring.addLargeHeader("Storage");

    for (const table of props.tables) {
      monitoring.monitorDynamoTable({
        table,
        alarmFriendlyName: table.node.id,
        humanReadableName: table.node.id,
      });
    }

    for (const bucket of props.buckets) {
      monitoring.monitorS3Bucket({
        bucket,
        alarmFriendlyName: bucket.node.id,
        humanReadableName: bucket.node.id,
      });
    }

    if (props.aurora) {
      monitoring.monitorAuroraCluster({
        cluster: props.aurora,
        alarmFriendlyName: props.aurora.node.id,
        humanReadableName: props.aurora.node.id,
      });
    }

    if (props.opensearch) {
      const link = `https://${region}.console.aws.amazon.com/aos/home?region=${region}#opensearch/collections/${props.opensearch.name}`;
      const title = `OpenSearch [**${props.opensearch.node.id}**](${link})`;
      this.addOpenSearchMetrics(monitoring, props.opensearch, title);
    }

    if (props.kendra) {
      const link = `https://${region}.console.aws.amazon.com/kendra/home?region=${region}#indexes/${props.kendra.ref}`;
      const title = `Kendra [**${props.kendra.node.id}**](${link})`;
      this.addKendraMonitoring(monitoring, props.kendra, title);
    }

    monitoring.addLargeHeader("Requests Processing");
    for (const queue of props.sqs) {
      if (!queue.deadLetterQueue) {
        throw new Error("Please create a DLQ for " + queue.node.id);
      }
      monitoring.monitorSqsQueueWithDlq({
        queue: queue,
        deadLetterQueue: queue.deadLetterQueue.queue,
        alarmFriendlyName: queue.node.id,
        humanReadableName: queue.node.id,
      });
    }
    monitoring.addLargeHeader("RAG Processing");
    for (const fct of props.ragStateMachineProcessing) {
      monitoring.monitorStepFunction({
        stateMachine: fct,
        humanReadableName: fct.node.id,
        alarmFriendlyName: fct.node.id,
      });
    }
    for (const fct of props.ragFunctionProcessing) {
      monitoring.monitorLambdaFunction({
        lambdaFunction: fct,
        humanReadableName: fct.node.id,
        alarmFriendlyName: fct.node.id,
      });
    }
  }

  private addMetricFilter(
    namespace: string,
    monitoring: MonitoringFacade,
    logGroups: ILogGroup[]
  ) {
    for (const logGroupKey in logGroups) {
      new MetricFilter(this, "UsageFilter" + logGroupKey, {
        logGroup: logGroups[logGroupKey],
        metricNamespace: namespace,
        metricName: "TokenUsage",
        filterPattern: FilterPattern.stringValue(
          "$.metric_type",
          "=",
          "token_usage"
        ),
        metricValue: "$.value",
        dimensions: {
          model: "$.model",
        },
      });
    }

    monitoring.monitorCustom({
      alarmFriendlyName: "TokenUsage",
      humanReadableName: "Token Usage",
      metricGroups: [
        {
          title: "LLM Usage",
          metrics: [
            {
              alarmFriendlyName: "TokenUsage",
              metric: new MathExpression({
                label: "Tokens",
                expression: `SEARCH('{${namespace},model} MetricName=TokenUsage', 'Sum', 60)`,
              }),
              addAlarm: {},
            },
            {
              alarmFriendlyName: "LLMChains Calls",
              metric: new MathExpression({
                label: "Calls",
                expression: `SEARCH('{${namespace},model} MetricName=TokenUsage', 'SampleCount', 60)`,
              }),
              addAlarm: {},
              position: AxisPosition.RIGHT,
            },
          ],
        },
      ],
    });
  }

  private addCognitoMetrics(
    monitoring: MonitoringFacade,
    userpoolId: string,
    clientId: string,
    title: string
  ): void {
    const namespace = "AWS/Cognito";
    const dimensionsMap = {
      UserPool: userpoolId,
      UserPoolClient: clientId,
    };
    monitoring.monitorCustom({
      alarmFriendlyName: "Cognito",
      humanReadableName: title,
      metricGroups: [
        {
          title: "SignIn",
          metrics: [
            {
              alarmFriendlyName: "SignInSuccesses",
              metric: new Metric({
                namespace,
                dimensionsMap,
                metricName: "SignInSuccesses",
                statistic: "sum",
              }),
              addAlarm: {},
            },
            {
              alarmFriendlyName: "FederationSuccesses",
              metric: new Metric({
                namespace,
                dimensionsMap,
                metricName: "FederationSuccesses",
                statistic: "sum",
              }),
              addAlarm: {},
              position: AxisPosition.RIGHT,
            },
          ],
        },
      ],
    });
  }
  private addOpenSearchMetrics(
    monitoring: MonitoringFacade,
    collection: CfnCollection,
    title: string
  ): void {
    const namespace = "AWS/AOSS";
    const dimensionsMap = {
      CollectionId: collection.ref,
      ClientId: Stack.of(this.scope).account,
      CollectionName: collection.name,
    };
    monitoring.monitorCustom({
      alarmFriendlyName: "OpenSearch",
      humanReadableName: title,
      metricGroups: [
        {
          title: "Search",
          metrics: [
            {
              alarmFriendlyName: "SearchRequestRate",
              metric: new Metric({
                namespace,
                dimensionsMap,
                metricName: "SearchRequestRate",
                statistic: "sum",
              }),
              addAlarm: {},
            },
            {
              alarmFriendlyName: "SearchRequestLatency",
              metric: new Metric({
                namespace,
                dimensionsMap,
                metricName: "SearchRequestLatency",
                statistic: "avg",
              }),
              addAlarm: {},
              position: AxisPosition.RIGHT,
            },
          ],
        },
        {
          title: "Errors",
          metrics: [
            {
              alarmFriendlyName: "IngestionRequestErrors",
              metric: new Metric({
                namespace,
                dimensionsMap,
                metricName: "IngestionRequestErrors",
                statistic: "sum",
              }),
              addAlarm: {},
            },
            {
              alarmFriendlyName: "SearchRequestErrors",
              metric: new Metric({
                namespace,
                dimensionsMap,
                metricName: "SearchRequestErrors",
                statistic: "sum",
              }),
              addAlarm: {},
            },
          ],
        },
      ],
    });
  }
  private addKendraMonitoring(
    monitoring: MonitoringFacade,
    kendra: CfnIndex,
    title: string
  ): void {
    const namespace = "AWS/Kendra";
    const dimensionsMap = {
      IndexId: kendra.ref,
    };
    monitoring.monitorCustom({
      alarmFriendlyName: "Kendra",
      humanReadableName: title,
      metricGroups: [
        {
          title: "Search",
          metrics: [
            {
              alarmFriendlyName: "IndexQueryCount",
              metric: new Metric({
                namespace,
                dimensionsMap,
                metricName: "IndexQueryCount",
                statistic: "sum",
              }),
              addAlarm: {},
            },
            {
              alarmFriendlyName: "IndexDocumentCount",
              metric: new Metric({
                namespace,
                dimensionsMap,
                metricName: "IndexDocumentCount",
                statistic: "sum",
              }),
              addAlarm: {},
              position: AxisPosition.RIGHT,
            },
          ],
        },
      ],
    });
  }

  private getLogsWidget(
    title: string,
    logGroups: ILogGroup[],
    extraFields: string[]
  ): LogQueryWidget {
    // Log Query Results
    return new LogQueryWidget({
      logGroupNames: logGroups.map((i) => i.logGroupName),
      height: 5,
      width: 24, // Full width
      title: title,
      /**
       * https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/CWL_QuerySyntax.html
       */
      queryLines: [
        "fields @timestamp, message, level, location" +
          (extraFields.length > 0 ? "," + extraFields.join(",") : ""),
        `filter ispresent(level)`, // only includes messages using the logger
        "sort @timestamp desc",
        `limit 200`,
      ],
    });
  }
}
