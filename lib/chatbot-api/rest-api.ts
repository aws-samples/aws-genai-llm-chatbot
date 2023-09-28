import * as path from "path";
import { Construct } from "constructs";
import { Shared } from "../shared";
import { SystemConfig, SageMakerLLMEndpoint } from "../shared/types";
import { RagEngines } from "../rag-engines";
import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as ssm from "aws-cdk-lib/aws-ssm";

export interface RestApiProps {
  readonly shared: Shared;
  readonly config: SystemConfig;
  readonly ragEngines?: RagEngines;
  readonly userPool: cognito.UserPool;
  readonly sessionsTable: dynamodb.Table;
  readonly byUserIdIndex: string;
  readonly llmsParameter: ssm.StringParameter;
  readonly llms: SageMakerLLMEndpoint[];
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
        props.shared.commonLayer.layer,
        props.shared.pythonSDKLayer,
      ],
      vpc: props.shared.vpc,
      securityGroups: [apiSecurityGroup],
      vpcSubnets: props.shared.vpc.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      }),
      environment: {
        ...props.shared.defaultEnvironmentVariables,
        CONFIG_PARAMETER_NAME: props.shared.configParameter.parameterName,
        LARGE_LANGUAGE_MODELS_PARAMETER_NAME: props.llmsParameter.parameterName,
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
        if (!item.roleArn) continue;

        apiHandler.addToRolePolicy(
          new iam.PolicyStatement({
            actions: ["sts:AssumeRole"],
            resources: [item.roleArn],
          })
        );
      }
    }

    if (props.ragEngines?.fileImportWorkflow) {
      props.ragEngines.fileImportWorkflow.grantStartExecution(apiHandler);
    }

    if (props.ragEngines?.websiteCrawlingWorkflow) {
      props.ragEngines.websiteCrawlingWorkflow.grantStartExecution(apiHandler);
    }

    if (props.ragEngines?.sageMakerRagModelsEndpoint) {
      apiHandler.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ["sagemaker:InvokeEndpoint"],
          resources: [props.ragEngines?.sageMakerRagModelsEndpoint.ref],
        })
      );
    }

    for (const model of props.llms) {
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
    props.llmsParameter.grantRead(apiHandler);
    props.sessionsTable.grantReadWriteData(apiHandler);
    props.ragEngines?.uploadBucket.grantReadWrite(apiHandler);
    props.ragEngines?.processingBucket.grantReadWrite(apiHandler);

    if (props.config.bedrock?.enabled) {
      apiHandler.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ["bedrock:ListFoundationModels"],
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
