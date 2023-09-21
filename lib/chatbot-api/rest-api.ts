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
        AURORA_DB_SECRET_ID: props.ragEngines?.auroraDatabase?.secret
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
          props.ragEngines?.createAuroraWorkspaceWorkflow?.stateMachineArn ??
          "",
        FILE_IMPORT_WORKFLOW_ARN:
          props.ragEngines?.fileImportWorkflow?.stateMachineArn ?? "",
        WEBSITE_CRAWLING_WORKFLOW_ARN:
          props.ragEngines?.websiteCrawlingWorkflow?.stateMachineArn ?? "",
      },
    });

    if (props.ragEngines?.workspacesTable) {
      props.ragEngines.workspacesTable.grantReadWriteData(apiHandler);
    }

    if (props.ragEngines?.documentsTable) {
      props.ragEngines.documentsTable.grantReadWriteData(apiHandler);
    }

    if (props.ragEngines?.auroraDatabase) {
      props.ragEngines.auroraDatabase.secret?.grantRead(apiHandler);
      props.ragEngines.auroraDatabase.connections.allowDefaultPortFrom(
        apiHandler
      );
    }

    if (props.ragEngines?.createAuroraWorkspaceWorkflow) {
      props.ragEngines.createAuroraWorkspaceWorkflow.grantStartExecution(
        apiHandler
      );
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

    if (props.config.bedrock?.roleArn) {
      apiHandler.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ["sts:AssumeRole"],
          resources: [props.config.bedrock.roleArn],
        })
      );
    }

    const chatBotApi = new apigateway.RestApi(this, "ChatBotApi", {
      endpointTypes: [apigateway.EndpointType.REGIONAL],
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
