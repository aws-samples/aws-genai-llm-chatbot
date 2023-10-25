import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";
import * as path from "path";
import { RagEngines } from "../rag-engines";
import { Shared } from "../shared";
import { SageMakerModelEndpoint, SystemConfig } from "../shared/types";

export interface RestApiProps {
  readonly shared: Shared;
  readonly config: SystemConfig;
  readonly ragEngines?: RagEngines;
  readonly userPool: cognito.UserPool;
  readonly sessionsTable: dynamodb.Table;
  readonly byUserIdIndex: string;
  readonly modelsParameter: ssm.StringParameter;
  readonly models: SageMakerModelEndpoint[];
}

export class RestApi extends Construct {
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: RestApiProps) {
    super(scope, id);

    const apiSecurityGroup = new ec2.SecurityGroup(this, "ApiSecurityGroup", {
      vpc: props.shared.vpc,
    });

    const apiHandler = new lambda.Function(this, "ApiHandler", {
      code: lambda.Code.fromAsset(
        path.join(__dirname, "./functions/api-handler")
      ),
      handler: "index.handler",
      runtime: props.shared.pythonRuntime,
      architecture: props.shared.lambdaArchitecture,
      timeout: cdk.Duration.minutes(10),
      memorySize: 512,
      tracing: lambda.Tracing.ACTIVE,
      logRetention: logs.RetentionDays.ONE_WEEK,
      layers: [
        props.shared.powerToolsLayer,
        props.shared.commonLayer,
        props.shared.pythonSDKLayer,
      ],
      vpc: props.shared.vpc,
      securityGroups: [apiSecurityGroup],
      vpcSubnets: props.shared.vpc.privateSubnets as ec2.SubnetSelection,
      environment: {
        ...props.shared.defaultEnvironmentVariables,
        CONFIG_PARAMETER_NAME: props.shared.configParameter.parameterName,
        MODELS_PARAMETER_NAME: props.modelsParameter.parameterName,
        X_ORIGIN_VERIFY_SECRET_ARN: props.shared.xOriginVerifySecret.secretArn,
        API_KEYS_SECRETS_ARN: props.shared.apiKeysSecret.secretArn,
        SESSIONS_TABLE_NAME: props.sessionsTable.tableName,
        SESSIONS_BY_USER_ID_INDEX_NAME: props.byUserIdIndex,
        UPLOAD_BUCKET_NAME: props.ragEngines?.uploadBucket?.bucketName ?? "",
        PROCESSING_BUCKET_NAME:
          props.ragEngines?.processingBucket?.bucketName ?? "",
        AURORA_DB_SECRET_ID: props.ragEngines?.auroraPgVector?.database?.secret
          ?.secretArn as string,
        WORKSPACES_TABLE_NAME:
          props.ragEngines?.workspacesTable.tableName ?? "",
        WORKSPACES_BY_OBJECT_TYPE_INDEX_NAME:
          props.ragEngines?.workspacesByObjectTypeIndexName ?? "",
        DOCUMENTS_TABLE_NAME: props.ragEngines?.documentsTable.tableName ?? "",
        DOCUMENTS_BY_COMPOUND_KEY_INDEX_NAME:
          props.ragEngines?.documentsByCompountKeyIndexName ?? "",
        SAGEMAKER_RAG_MODELS_ENDPOINT:
          props.ragEngines?.sageMakerRagModelsEndpoint?.attrEndpointName ?? "",
        DELETE_WORKSPACE_WORKFLOW_ARN:
          props.ragEngines?.deleteWorkspaceWorkflow?.stateMachineArn ?? "",
        CREATE_AURORA_WORKSPACE_WORKFLOW_ARN:
          props.ragEngines?.auroraPgVector?.createAuroraWorkspaceWorkflow
            ?.stateMachineArn ?? "",
        CREATE_OPEN_SEARCH_WORKSPACE_WORKFLOW_ARN:
          props.ragEngines?.openSearchVector?.createOpenSearchWorkspaceWorkflow
            ?.stateMachineArn ?? "",
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
      },
    });

    if (props.ragEngines?.workspacesTable) {
      props.ragEngines.workspacesTable.grantReadWriteData(apiHandler);
    }

    if (props.ragEngines?.documentsTable) {
      props.ragEngines.documentsTable.grantReadWriteData(apiHandler);
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

      props.ragEngines.openSearchVector.addToAccessPolicy(
        "rest-api",
        [apiHandler.role?.roleArn],
        ["aoss:DescribeIndex", "aoss:ReadDocument", "aoss:WriteDocument"]
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

      for (const item of props.config.rag.engines.kendra.external || []) {
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
                `arn:${cdk.Aws.PARTITION}:kendra:${item.region}:${cdk.Aws.ACCOUNT_ID}:index/${item.kendraId}`,
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
      props.ragEngines.websiteCrawlingWorkflow.grantStartExecution(apiHandler);
    }

    if (props.ragEngines?.deleteWorkspaceWorkflow) {
      props.ragEngines.deleteWorkspaceWorkflow.grantStartExecution(apiHandler);
    }

    if (props.ragEngines?.sageMakerRagModelsEndpoint) {
      apiHandler.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ["sagemaker:InvokeEndpoint"],
          resources: [props.ragEngines?.sageMakerRagModelsEndpoint.ref],
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

    const chatBotApi = new apigateway.RestApi(this, "ChatBotApi", {
      endpointTypes: [apigateway.EndpointType.REGIONAL],
      cloudWatchRole: true,
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ["Content-Type", "Authorization", "X-Amz-Date"],
        maxAge: cdk.Duration.minutes(10),
      },
      deploy: true,
      deployOptions: {
        stageName: "api",
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        tracingEnabled: true,
        metricsEnabled: true,
        throttlingRateLimit: 2500,
      },
    });

    const cognitoAuthorizer = new apigateway.CfnAuthorizer(
      this,
      "ApiGatewayCognitoAuthorizer",
      {
        name: "CognitoAuthorizer",
        identitySource: "method.request.header.Authorization",
        providerArns: [props.userPool.userPoolArn],
        restApiId: chatBotApi.restApiId,
        type: apigateway.AuthorizationType.COGNITO,
      }
    );

    const v1Resource = chatBotApi.root.addResource("v1", {
      defaultMethodOptions: {
        authorizationType: apigateway.AuthorizationType.COGNITO,
        authorizer: { authorizerId: cognitoAuthorizer.ref },
      },
    });
    const v1ProxyResource = v1Resource.addResource("{proxy+}");
    v1ProxyResource.addMethod(
      "ANY",
      new apigateway.LambdaIntegration(apiHandler, {
        proxy: true,
      })
    );

    this.api = chatBotApi;
  }
}
