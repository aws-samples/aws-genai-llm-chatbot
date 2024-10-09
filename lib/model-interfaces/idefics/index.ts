import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";
import * as logs from "aws-cdk-lib/aws-logs";
import * as s3 from "aws-cdk-lib/aws-s3";
import { CfnEndpoint } from "aws-cdk-lib/aws-sagemaker";
import * as sns from "aws-cdk-lib/aws-sns";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import * as path from "path";
import { Shared } from "../../shared";
import { SystemConfig } from "../../shared/types";
import { NagSuppressions } from "cdk-nag";

interface IdeficsInterfaceProps {
  readonly shared: Shared;
  readonly config: SystemConfig;
  readonly messagesTopic: sns.Topic;
  readonly sessionsTable: dynamodb.Table;
  readonly byUserIdIndex: string;
  readonly chatbotFilesBucket: s3.Bucket;
  readonly createPrivateGateway: boolean;
}

export class IdeficsInterface extends Construct {
  public readonly ingestionQueue: sqs.Queue;
  public readonly requestHandler: lambda.Function;

  constructor(
    scope: Construct,
    id: string,
    private props: IdeficsInterfaceProps
  ) {
    super(scope, id);

    const lambdaDurationInMinutes = 15;

    let api;
    if (props.createPrivateGateway) {
      api = this.createAPIGW();
    }

    const requestHandler = new lambda.Function(
      this,
      "MultiModalInterfaceRequestHandler",
      {
        vpc: props.shared.vpc,
        code: props.shared.sharedCode.bundleWithLambdaAsset(
          path.join(__dirname, "./functions/request-handler")
        ),
        description: "Multi modal request handler",
        runtime: props.shared.pythonRuntime,
        handler: "index.handler",
        layers: [props.shared.powerToolsLayer, props.shared.commonLayer],
        architecture: props.shared.lambdaArchitecture,
        tracing: props.config.advancedMonitoring
          ? lambda.Tracing.ACTIVE
          : lambda.Tracing.DISABLED,
        timeout: cdk.Duration.minutes(lambdaDurationInMinutes),
        memorySize: 1024,
        logRetention: props.config.logRetention ?? logs.RetentionDays.ONE_WEEK,
        loggingFormat: lambda.LoggingFormat.JSON,
        environment: {
          ...props.shared.defaultEnvironmentVariables,
          CONFIG_PARAMETER_NAME: props.shared.configParameter.parameterName,
          SESSIONS_TABLE_NAME: props.sessionsTable.tableName,
          SESSIONS_BY_USER_ID_INDEX_NAME: props.byUserIdIndex,
          MESSAGES_TOPIC_ARN: props.messagesTopic.topicArn,
          CHATBOT_FILES_BUCKET_NAME: props.chatbotFilesBucket.bucketName,
          CHATBOT_FILES_PRIVATE_API: api?.url ?? "",
        },
      }
    );

    props.chatbotFilesBucket.grantRead(requestHandler);
    props.sessionsTable.grantReadWriteData(requestHandler);
    props.messagesTopic.grantPublish(requestHandler);
    if (props.shared.kmsKey && requestHandler.role) {
      props.shared.kmsKey.grantEncrypt(requestHandler.role);
    }
    props.shared.configParameter.grantRead(requestHandler);
    requestHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["bedrock:InvokeModel"],
        resources: ["*"],
        effect: iam.Effect.ALLOW,
      })
    );

    const deadLetterQueue = new sqs.Queue(this, "DLQ", {
      enforceSSL: true,
      encryption: props.shared.queueKmsKey
        ? sqs.QueueEncryption.KMS
        : undefined,
      encryptionMasterKey: props.shared.queueKmsKey,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    const queue = new sqs.Queue(this, "IdeficsIngestionQueue", {
      encryption: props.shared.queueKmsKey
        ? sqs.QueueEncryption.KMS
        : undefined,
      encryptionMasterKey: props.shared.queueKmsKey,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      // https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html#events-sqs-queueconfig
      visibilityTimeout: cdk.Duration.minutes(lambdaDurationInMinutes * 6),
      enforceSSL: true,
      deadLetterQueue: {
        queue: deadLetterQueue,
        maxReceiveCount: 3,
      },
    });

    queue.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ["sqs:SendMessage"],
        resources: [queue.queueArn],
        principals: [
          new iam.ServicePrincipal("events.amazonaws.com"),
          new iam.ServicePrincipal("sqs.amazonaws.com"),
        ],
      })
    );

    requestHandler.addEventSource(new lambdaEventSources.SqsEventSource(queue));

    this.ingestionQueue = queue;
    this.requestHandler = requestHandler;
  }

  public addSageMakerEndpoint({
    endpoint,
    name,
  }: {
    endpoint: CfnEndpoint;
    name: string;
  }) {
    this.requestHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["sagemaker:InvokeEndpoint"],
        resources: [endpoint.ref],
      })
    );
    const cleanName = name.replace(/[\s.\-_]/g, "").toUpperCase();
    this.requestHandler.addEnvironment(
      `SAGEMAKER_ENDPOINT_${cleanName}`,
      endpoint.attrEndpointName
    );
  }

  private createAPIGW(): apigateway.RestApi {
    // Create a private API to serve images and other files from S3
    // in order to avoid using signed URLs and run out of input tokens
    // with the idefics model
    const defaultSecurityGroup =
      this.props.config.vpc?.vpcId &&
      this.props.config.vpc.vpcDefaultSecurityGroup
        ? this.props.config.vpc.vpcDefaultSecurityGroup
        : this.props.shared.vpc.vpcDefaultSecurityGroup;

    const vpcDefaultSecurityGroup = defaultSecurityGroup
      ? ec2.SecurityGroup.fromSecurityGroupId(
          this,
          "VPCDefaultSecurityGroup",
          defaultSecurityGroup
        )
      : ec2.SecurityGroup.fromLookupByName(
          this,
          "VPCDefaultSecurityGroup",
          "default",
          this.props.shared.vpc
        );

    const vpcEndpoint = this.props.shared.vpc.addInterfaceEndpoint(
      "PrivateApiEndpoint",
      {
        service: ec2.InterfaceVpcEndpointAwsService.APIGATEWAY,
        privateDnsEnabled: true,
        open: true,
        securityGroups: [vpcDefaultSecurityGroup],
      }
    );

    const logGroup = new logs.LogGroup(
      this,
      "ChatbotFilesPrivateApiAccessLogs",
      {
        removalPolicy:
          this.props.config.retainOnDelete === true
            ? cdk.RemovalPolicy.RETAIN_ON_UPDATE_OR_DELETE
            : cdk.RemovalPolicy.DESTROY,
        retention: this.props.config.logRetention,
      }
    );

    const api = new apigateway.RestApi(this, "ChatbotFilesPrivateApi", {
      deployOptions: {
        stageName: "prod",
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        tracingEnabled: true,
        metricsEnabled: true,
        accessLogDestination: new apigateway.LogGroupLogDestination(logGroup),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields(),
      },
      cloudWatchRole: true,
      binaryMediaTypes: ["*/*"],
      endpointConfiguration: {
        types: [apigateway.EndpointType.PRIVATE],
        vpcEndpoints: [vpcEndpoint],
      },
      policy: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            actions: ["execute-api:Invoke"],
            effect: iam.Effect.ALLOW,
            resources: ["execute-api:/*/*/*"],
            principals: [new iam.AnyPrincipal()], // NOSONAR
            // Private integration with deny based on the VPCe
          }),
          new iam.PolicyStatement({
            actions: ["execute-api:Invoke"],
            effect: iam.Effect.DENY,
            resources: ["execute-api:/*/*/*"],
            principals: [new iam.AnyPrincipal()],
            conditions: {
              StringNotEquals: {
                "aws:SourceVpce": vpcEndpoint.vpcEndpointId,
              },
            },
          }),
        ],
      }),
    });

    api.addRequestValidator("ValidateRequest", {
      requestValidatorName: "chatbot-files-private-api-validator",
      validateRequestBody: true,
      validateRequestParameters: true,
    });

    // Create an API Gateway resource that proxies to the S3 bucket:
    const integrationRole = new iam.Role(this, "S3IntegrationRole", {
      assumedBy: new iam.ServicePrincipal("apigateway.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AmazonAPIGatewayPushToCloudWatchLogs"
        ),
      ],
    });
    integrationRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["s3:GetObject*"],
        effect: iam.Effect.ALLOW,
        resources: [`${this.props.chatbotFilesBucket.bucketArn}/private/*`],
      })
    );

    const s3Integration = new apigateway.AwsIntegration({
      service: "s3",
      integrationHttpMethod: "GET",
      region: cdk.Aws.REGION,
      path: `${this.props.chatbotFilesBucket.bucketName}/private/{folder}/{key}`,
      options: {
        credentialsRole: integrationRole,
        requestParameters: {
          "integration.request.path.folder": "method.request.path.folder",
          "integration.request.path.key": "method.request.path.key",
        },
        integrationResponses: [
          {
            statusCode: "200",
            responseParameters: {
              "method.response.header.Content-Type":
                "integration.response.header.Content-Type",
            },
          },
        ],
      },
    });

    // prettier-ignore
    api.root
      .addResource("{folder}")
      .addResource("{key}")
      .addMethod("GET", s3Integration, { // NOSONAR Private integration
        methodResponses: [
          {
            statusCode: "200",
            responseParameters: {
              "method.response.header.Content-Type": true,
            },
          },
        ],
        requestParameters: {
          "method.request.path.folder": true,
          "method.request.path.key": true,
          "method.request.header.Content-Type": true,
        },
      });

    /**
     * CDK NAG suppression
     */
    NagSuppressions.addResourceSuppressions(integrationRole, [
      {
        id: "AwsSolutions-IAM4",
        reason:
          "Access to all log groups required for CloudWatch log group creation.",
      },
      { id: "AwsSolutions-IAM5", reason: "Access limited to KMS resources." },
    ]);
    return api;
  }
}
