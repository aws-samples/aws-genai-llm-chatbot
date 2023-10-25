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

interface IdeficsInterfaceProps {
  readonly shared: Shared;
  readonly config: SystemConfig;
  readonly messagesTopic: sns.Topic;
  readonly sessionsTable: dynamodb.Table;
  readonly byUserIdIndex: string;
  readonly chatbotFilesBucket: s3.Bucket;
}

export class IdeficsInterface extends Construct {
  public readonly ingestionQueue: sqs.Queue;
  public readonly requestHandler: lambda.Function;

  constructor(scope: Construct, id: string, props: IdeficsInterfaceProps) {
    super(scope, id);

    const lambdaDurationInMinutes = 15;

    // Create a private API to serve images and other files from S3
    // in order to avoid using signed URLs and run out of input tokens
    // with the idefics model
    const vpcDefaultSecurityGroup = ec2.SecurityGroup.fromSecurityGroupId(
      this,
      "VPCDefaultSecurityGroup",
      props.shared.vpc.vpcDefaultSecurityGroup
    );

    const vpcEndpoint = props.shared.vpc.addInterfaceEndpoint(
      "PrivateApiEndpoint",
      {
        service: ec2.InterfaceVpcEndpointAwsService.APIGATEWAY,
        privateDnsEnabled: true,
        open: true,
        securityGroups: [vpcDefaultSecurityGroup],
      }
    );

    const api = new apigateway.RestApi(this, "ChatbotFilesPrivateApi", {
      deployOptions: {
        stageName: "prod",
      },
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
            principals: [new iam.AnyPrincipal()],
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
        actions: ["s3:Get*", "s3:List*"],
        effect: iam.Effect.ALLOW,
        resources: [
          `${props.chatbotFilesBucket.bucketArn}/*`,
          `${props.chatbotFilesBucket.bucketArn}/*/*`,
        ],
      })
    );
    integrationRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["kms:Decrypt", "kms:ReEncryptFrom"],
        effect: iam.Effect.ALLOW,
        resources: ["*"],
      })
    );

    const s3Integration = new apigateway.AwsIntegration({
      service: "s3",
      integrationHttpMethod: "GET",
      region: cdk.Aws.REGION,
      path: `${props.chatbotFilesBucket.bucketName}/public/{object}`,
      options: {
        credentialsRole: integrationRole,
        requestParameters: {
          "integration.request.path.object": "method.request.path.object",
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

    const fileResource = api.root.addResource("{object}");
    fileResource.addMethod("ANY", s3Integration, {
      methodResponses: [
        {
          statusCode: "200",
          responseParameters: {
            "method.response.header.Content-Type": true,
          },
        },
      ],
      requestParameters: {
        "method.request.path.object": true,
        "method.request.header.Content-Type": true,
      },
    });

    const requestHandler = new lambda.Function(
      this,
      "IdeficsInterfaceRequestHandler",
      {
        vpc: props.shared.vpc,
        code: lambda.Code.fromAsset(
          path.join(__dirname, "./functions/request-handler")
        ),
        runtime: props.shared.pythonRuntime,
        handler: "index.handler",
        layers: [
          props.shared.powerToolsLayer,
          props.shared.commonLayer,
          props.shared.pythonSDKLayer,
        ],
        architecture: props.shared.lambdaArchitecture,
        tracing: lambda.Tracing.ACTIVE,
        timeout: cdk.Duration.minutes(lambdaDurationInMinutes),
        memorySize: 1024,
        logRetention: logs.RetentionDays.ONE_WEEK,
        environment: {
          ...props.shared.defaultEnvironmentVariables,
          CONFIG_PARAMETER_NAME: props.shared.configParameter.parameterName,
          SESSIONS_TABLE_NAME: props.sessionsTable.tableName,
          SESSIONS_BY_USER_ID_INDEX_NAME: props.byUserIdIndex,
          MESSAGES_TOPIC_ARN: props.messagesTopic.topicArn,
          CHATBOT_FILES_BUCKET_NAME: props.chatbotFilesBucket.bucketName,
          CHATBOT_FILES_PRIVATE_API: api.url,
        },
      }
    );

    props.chatbotFilesBucket.grantRead(requestHandler);
    props.sessionsTable.grantReadWriteData(requestHandler);
    props.messagesTopic.grantPublish(requestHandler);
    props.shared.configParameter.grantRead(requestHandler);

    const deadLetterQueue = new sqs.Queue(this, "DLQ");
    const queue = new sqs.Queue(this, "Queue", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      // https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html#events-sqs-queueconfig
      visibilityTimeout: cdk.Duration.minutes(lambdaDurationInMinutes * 6),
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
}
