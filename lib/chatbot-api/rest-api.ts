import * as path from "path";
import * as cdk from "aws-cdk-lib";
import { SageMakerModelEndpoint, SystemConfig } from "../shared/types";
import { Construct } from "constructs";
import { RagEngines } from "../rag-engines";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { Shared } from "../shared";
import * as appsync from "aws-cdk-lib/aws-appsync";
import { parse } from "graphql";
import { readFileSync } from "fs";
import * as s3 from "aws-cdk-lib/aws-s3";

export interface ApiResolversProps {
  readonly shared: Shared;
  readonly config: SystemConfig;
  readonly ragEngines?: RagEngines;
  readonly userPool: cognito.UserPool;
  readonly sessionsTable: dynamodb.Table;
  readonly byUserIdIndex: string;
  readonly filesBucket: s3.Bucket;
  readonly userFeedbackBucket: s3.Bucket;
  readonly modelsParameter: ssm.StringParameter;
  readonly models: SageMakerModelEndpoint[];
  readonly api: appsync.GraphqlApi;
}

export class ApiResolvers extends Construct {
  readonly appSyncLambdaResolver: lambda.Function;
  constructor(scope: Construct, id: string, props: ApiResolversProps) {
    super(scope, id);

    const apiSecurityGroup = new ec2.SecurityGroup(this, "ApiSecurityGroup", {
      vpc: props.shared.vpc,
    });

    const appSyncLambdaResolver = new lambda.Function(
      this,
      "GraphQLApiHandler",
      {
        code: props.shared.sharedCode.bundleWithLambdaAsset(
          path.join(__dirname, "./functions/api-handler")
        ),
        handler: "index.handler",
        description: "Main Appsync resolver",
        runtime: props.shared.pythonRuntime,
        architecture: props.shared.lambdaArchitecture,
        timeout: cdk.Duration.minutes(10),
        memorySize: 512,
        tracing: props.config.advancedMonitoring
          ? lambda.Tracing.ACTIVE
          : lambda.Tracing.DISABLED,
        logRetention: props.config.logRetention ?? logs.RetentionDays.ONE_WEEK,
        loggingFormat: lambda.LoggingFormat.JSON,
        layers: [props.shared.powerToolsLayer, props.shared.commonLayer],
        vpc: props.shared.vpc,
        securityGroups: [apiSecurityGroup],
        vpcSubnets: props.shared.vpc.privateSubnets as ec2.SubnetSelection,
        environment: {
          ...props.shared.defaultEnvironmentVariables,
          CONFIG_PARAMETER_NAME: props.shared.configParameter.parameterName,
          MODELS_PARAMETER_NAME: props.modelsParameter.parameterName,
          X_ORIGIN_VERIFY_SECRET_ARN:
            props.shared.xOriginVerifySecret.secretArn,
          API_KEYS_SECRETS_ARN: props.shared.apiKeysSecret.secretArn,
          SESSIONS_TABLE_NAME: props.sessionsTable.tableName,
          SESSIONS_BY_USER_ID_INDEX_NAME: props.byUserIdIndex,
          USER_FEEDBACK_BUCKET_NAME: props.userFeedbackBucket?.bucketName ?? "",
          UPLOAD_BUCKET_NAME: props.ragEngines?.uploadBucket?.bucketName ?? "",
          CHATBOT_FILES_BUCKET_NAME: props.filesBucket.bucketName,
          PROCESSING_BUCKET_NAME:
            props.ragEngines?.processingBucket?.bucketName ?? "",
          AURORA_DB_SECRET_ID: props.ragEngines?.auroraPgVector?.database
            ?.secret?.secretArn as string,
          WORKSPACES_TABLE_NAME:
            props.ragEngines?.workspacesTable.tableName ?? "",
          WORKSPACES_BY_OBJECT_TYPE_INDEX_NAME:
            props.ragEngines?.workspacesByObjectTypeIndexName ?? "",
          DOCUMENTS_TABLE_NAME:
            props.ragEngines?.documentsTable.tableName ?? "",
          DOCUMENTS_BY_COMPOUND_KEY_INDEX_NAME:
            props.ragEngines?.documentsByCompountKeyIndexName ?? "",
          DOCUMENTS_BY_STATUS_INDEX:
            props.ragEngines?.documentsByStatusIndexName ?? "",
          SAGEMAKER_RAG_MODELS_ENDPOINT:
            props.ragEngines?.sageMakerRagModels?.model.endpoint
              ?.attrEndpointName ?? "",
          DELETE_WORKSPACE_WORKFLOW_ARN:
            props.ragEngines?.deleteWorkspaceWorkflow?.stateMachineArn ?? "",
          DELETE_DOCUMENT_WORKFLOW_ARN:
            props.ragEngines?.deleteDocumentWorkflow?.stateMachineArn ?? "",
          CREATE_AURORA_WORKSPACE_WORKFLOW_ARN:
            props.ragEngines?.auroraPgVector?.createAuroraWorkspaceWorkflow
              ?.stateMachineArn ?? "",
          CREATE_OPEN_SEARCH_WORKSPACE_WORKFLOW_ARN:
            props.ragEngines?.openSearchVector
              ?.createOpenSearchWorkspaceWorkflow?.stateMachineArn ?? "",
          CREATE_KENDRA_WORKSPACE_WORKFLOW_ARN:
            props.ragEngines?.kendraRetrieval?.createKendraWorkspaceWorkflow
              ?.stateMachineArn ?? "",
          FILE_IMPORT_WORKFLOW_ARN:
            props.ragEngines?.fileImportWorkflow?.stateMachineArn ?? "",
          WEBSITE_CRAWLING_WORKFLOW_ARN:
            props.ragEngines?.websiteCrawlingWorkflow?.stateMachineArn ?? "",
          OPEN_SEARCH_COLLECTION_ENDPOINT:
            props.ragEngines?.openSearchVector?.openSearchCollectionEndpoint ??
            "",
          DEFAULT_KENDRA_INDEX_ID:
            props.ragEngines?.kendraRetrieval?.kendraIndex?.attrId ?? "",
          DEFAULT_KENDRA_INDEX_NAME:
            props.ragEngines?.kendraRetrieval?.kendraIndex?.name ?? "",
          DEFAULT_KENDRA_S3_DATA_SOURCE_ID:
            props.ragEngines?.kendraRetrieval?.kendraS3DataSource?.attrId ?? "",
          DEFAULT_KENDRA_S3_DATA_SOURCE_BUCKET_NAME:
            props.ragEngines?.kendraRetrieval?.kendraS3DataSourceBucket
              ?.bucketName ?? "",
          RSS_FEED_INGESTOR_FUNCTION:
            props.ragEngines?.dataImport.rssIngestorFunction?.functionArn ?? "",
        },
      }
    );
    this.appSyncLambdaResolver = appSyncLambdaResolver;

    function addPermissions(apiHandler: lambda.Function) {
      if (props.ragEngines?.workspacesTable) {
        props.ragEngines.workspacesTable.grantReadWriteData(apiHandler);
      }

      if (props.ragEngines?.documentsTable) {
        props.ragEngines.documentsTable.grantReadWriteData(apiHandler);
        props.ragEngines?.dataImport.rssIngestorFunction?.grantInvoke(
          apiHandler
        );
      }

      if (props.ragEngines?.auroraPgVector) {
        props.ragEngines.auroraPgVector.database.secret?.grantRead(apiHandler);
        props.ragEngines.auroraPgVector.database.connections.allowDefaultPortFrom(
          apiHandler
        );

        props.ragEngines.auroraPgVector.createAuroraWorkspaceWorkflow.grantStartExecution(
          apiHandler
        );
      }

      if (props.ragEngines?.openSearchVector) {
        apiHandler.addToRolePolicy(
          new iam.PolicyStatement({
            actions: ["aoss:APIAccessAll"],
            resources: [
              props.ragEngines?.openSearchVector.openSearchCollection.attrArn,
            ],
          })
        );

        props.ragEngines.openSearchVector.createOpenSearchWorkspaceWorkflow.grantStartExecution(
          apiHandler
        );
      }

      if (props.ragEngines?.kendraRetrieval) {
        props.ragEngines.kendraRetrieval.createKendraWorkspaceWorkflow.grantStartExecution(
          apiHandler
        );

        props.ragEngines?.kendraRetrieval?.kendraS3DataSourceBucket?.grantReadWrite(
          apiHandler
        );

        if (props.ragEngines.kendraRetrieval.kendraIndex) {
          apiHandler.addToRolePolicy(
            new iam.PolicyStatement({
              actions: [
                "kendra:Retrieve",
                "kendra:Query",
                "kendra:BatchDeleteDocument",
                "kendra:BatchPutDocument",
                "kendra:StartDataSourceSyncJob",
                "kendra:DescribeDataSourceSyncJob",
                "kendra:StopDataSourceSyncJob",
                "kendra:ListDataSourceSyncJobs",
                "kendra:ListDataSources",
                "kendra:DescribeIndex",
              ],
              resources: [
                props.ragEngines.kendraRetrieval.kendraIndex.attrArn,
                `${props.ragEngines.kendraRetrieval.kendraIndex.attrArn}/*`,
              ],
            })
          );
        }

        if (props.config.rag.engines.knowledgeBase?.enabled) {
          for (const item of props.config.rag.engines.knowledgeBase.external ||
            []) {
            if (item.roleArn) {
              apiHandler.addToRolePolicy(
                new iam.PolicyStatement({
                  actions: ["sts:AssumeRole"],
                  resources: [item.roleArn],
                })
              );
            } else {
              apiHandler.addToRolePolicy(
                new iam.PolicyStatement({
                  actions: ["bedrock:Retrieve"],
                  resources: [
                    `arn:${cdk.Aws.PARTITION}:bedrock:${
                      item.region ?? cdk.Aws.REGION
                    }:${cdk.Aws.ACCOUNT_ID}:knowledge-base/${
                      item.knowledgeBaseId
                    }`,
                  ],
                })
              );
            }
          }
        }

        for (const item of props.config.rag.engines.kendra.external ?? []) {
          if (item.roleArn) {
            apiHandler.addToRolePolicy(
              new iam.PolicyStatement({
                actions: ["sts:AssumeRole"],
                resources: [item.roleArn],
              })
            );
          } else {
            apiHandler.addToRolePolicy(
              new iam.PolicyStatement({
                actions: ["kendra:Retrieve", "kendra:Query"],
                resources: [
                  `arn:${cdk.Aws.PARTITION}:kendra:${
                    item.region ?? cdk.Aws.REGION
                  }:${cdk.Aws.ACCOUNT_ID}:index/${item.kendraId}`,
                ],
              })
            );
          }
        }
      }

      if (props.ragEngines?.fileImportWorkflow) {
        props.ragEngines.fileImportWorkflow.grantStartExecution(apiHandler);
      }

      if (props.ragEngines?.websiteCrawlingWorkflow) {
        props.ragEngines.websiteCrawlingWorkflow.grantStartExecution(
          apiHandler
        );
      }

      if (props.ragEngines?.deleteWorkspaceWorkflow) {
        props.ragEngines.deleteWorkspaceWorkflow.grantStartExecution(
          apiHandler
        );
      }

      if (props.ragEngines?.deleteDocumentWorkflow) {
        props.ragEngines.deleteDocumentWorkflow.grantStartExecution(apiHandler);
      }

      if (props.ragEngines?.sageMakerRagModels) {
        apiHandler.addToRolePolicy(
          new iam.PolicyStatement({
            actions: ["sagemaker:InvokeEndpoint"],
            resources: [props.ragEngines.sageMakerRagModels.model.endpoint.ref],
          })
        );
      }

      for (const model of props.models) {
        apiHandler.addToRolePolicy(
          new iam.PolicyStatement({
            actions: ["sagemaker:InvokeEndpoint"],
            resources: [model.endpoint.ref],
          })
        );
      }

      apiHandler.addToRolePolicy(
        new iam.PolicyStatement({
          actions: [
            "comprehend:DetectDominantLanguage",
            "comprehend:DetectSentiment",
          ],
          resources: ["*"],
        })
      );

      props.shared.xOriginVerifySecret.grantRead(apiHandler);
      props.shared.apiKeysSecret.grantRead(apiHandler);
      props.shared.configParameter.grantRead(apiHandler);
      props.modelsParameter.grantRead(apiHandler);
      props.sessionsTable.grantReadWriteData(apiHandler);
      props.userFeedbackBucket.grantReadWrite(apiHandler);
      props.filesBucket.grantReadWrite(apiHandler);
      props.ragEngines?.uploadBucket.grantReadWrite(apiHandler);
      props.ragEngines?.processingBucket.grantReadWrite(apiHandler);

      if (props.config.bedrock?.enabled) {
        apiHandler.addToRolePolicy(
          new iam.PolicyStatement({
            actions: [
              "bedrock:ListFoundationModels",
              "bedrock:ListCustomModels",
              "bedrock:InvokeModel",
              "bedrock:InvokeModelWithResponseStream",
            ],
            resources: ["*"],
          })
        );

        if (props.config.bedrock?.roleArn) {
          apiHandler.addToRolePolicy(
            new iam.PolicyStatement({
              actions: ["sts:AssumeRole"],
              resources: [props.config.bedrock.roleArn],
            })
          );
        }
      }
    }

    addPermissions(appSyncLambdaResolver);

    props.ragEngines?.openSearchVector?.addToAccessPolicy(
      "graphql-api",
      [appSyncLambdaResolver.role?.roleArn],
      ["aoss:DescribeIndex", "aoss:ReadDocument", "aoss:WriteDocument"]
    );

    const functionDataSource = props.api.addLambdaDataSource(
      "proxyResolverFunction",
      appSyncLambdaResolver
    );

    const schema = parse(
      readFileSync("lib/chatbot-api/schema/schema.graphql", "utf8")
    );

    function addResolvers(operationType: string) {
      /* eslint-disable  @typescript-eslint/no-explicit-any */
      const fieldNames = (
        schema.definitions
          .filter((x) => x.kind == "ObjectTypeDefinition")
          .filter((y: any) => y.name.value == operationType)[0] as any
      ).fields.map((z: any) => z.name.value);
      /* eslint-enable  @typescript-eslint/no-explicit-any */

      for (const fieldName of fieldNames) {
        // These resolvers are added by the Realtime API
        if (fieldName == "sendQuery" || fieldName == "publishResponse") {
          continue;
        }
        props.api.createResolver(`${fieldName}-resolver`, {
          typeName: operationType,
          fieldName: fieldName,
          dataSource: functionDataSource,
        });
      }
    }

    addResolvers("Query");
    addResolvers("Mutation");
  }
}
