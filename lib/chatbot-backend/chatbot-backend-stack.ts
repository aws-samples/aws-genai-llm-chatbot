import * as path from 'path';

import * as idpool from '@aws-cdk/aws-cognito-identitypool-alpha';
import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

import { LargeLanguageModel } from '../large-language-model';

export interface ChatBotBackendStackProps extends cdk.NestedStackProps {
  vpc: ec2.Vpc;
  largeLanguageModels: LargeLanguageModel[];
  semanticSearchApi: lambda.Function | null;
  maxParallelLLMQueries: number;
}

export class ChatBotBackendStack extends cdk.NestedStack {
  constructor(scope: Construct, id: string, props: ChatBotBackendStackProps) {
    super(scope, id, props);

    const { vpc, largeLanguageModels, semanticSearchApi, maxParallelLLMQueries } = props;
    const { userPool, userPoolClient, identityPool } = this.createCognito();

    const sessionTable = new dynamodb.Table(this, 'SessionTable', {
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sessionId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const indexName = 'StartTimeIndex';
    sessionTable.addGlobalSecondaryIndex({
      indexName,
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'startTime', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    const sendMessageFunction = new nodejs.NodejsFunction(this, 'SendMessageFunction', {
      entry: path.join(__dirname, './functions/send-message/index.ts'),
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.minutes(5),
      logRetention: logs.RetentionDays.ONE_DAY,
      reservedConcurrentExecutions: maxParallelLLMQueries,
      vpc: vpc,
      vpcSubnets: vpc.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      }),
      environment: {
        LARGE_LANGUAGE_MODELS: JSON.stringify(
          largeLanguageModels.reduce((acc, endpoint) => {
            acc[endpoint.modelId] = endpoint.endpoint.attrEndpointName;
            return acc;
          }, {} as { [key: string]: string }),
        ),
        USER_POOL_ID: userPool.userPoolId,
        USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
        SESSION_TABLE_NAME: sessionTable.tableName,
        SESSION_TABLE_START_TIME_INDEX_NAME: indexName,
        SEMANTIC_SEARCH_API: semanticSearchApi?.functionArn || '',
      },
    });

    sessionTable.grantReadWriteData(sendMessageFunction);

    sendMessageFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['sagemaker:InvokeEndpoint'],
        resources: largeLanguageModels.map((largeLanguageModel) => largeLanguageModel.endpoint.ref),
      }),
    );

    if (semanticSearchApi) {
      sendMessageFunction.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ['lambda:InvokeFunction'],
          resources: [semanticSearchApi.functionArn],
        }),
      );
    }

    const sendMessageFunctionUrl = new lambda.CfnUrl(this, 'SendMessageFunctionUrl', {
      authType: lambda.FunctionUrlAuthType.AWS_IAM,
      targetFunctionArn: sendMessageFunction.functionArn,
      cors: {
        allowCredentials: false,
        allowHeaders: ['*'],
        allowMethods: ['*'],
        allowOrigins: ['*'],
      },
      invokeMode: 'RESPONSE_STREAM',
    });

    new ssm.StringParameter(this, 'SendMessageFunctionUrlParam', {
      parameterName: '/chatbot/endpoints/send-message',
      stringValue: sendMessageFunctionUrl.attrFunctionUrl,
    });

    new ssm.StringParameter(this, 'SendMessageFunctionArnParam', {
      parameterName: '/chatbot/arn/send-message',
      stringValue: sendMessageFunctionUrl.attrFunctionArn,
    });

    const chatActionFunction = new nodejs.NodejsFunction(this, 'ChatActionFunction', {
      entry: path.join(__dirname, './functions/chat-action/index.ts'),
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.minutes(1),
      logRetention: logs.RetentionDays.ONE_DAY,
      vpc: vpc,
      vpcSubnets: vpc.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      }),
      environment: {
        USER_POOL_ID: userPool.userPoolId,
        LARGE_LANGUAGE_MODELS_IDS: largeLanguageModels.map((largeLanguageModel) => largeLanguageModel.modelId).join(','),
        USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
        SESSION_TABLE_NAME: sessionTable.tableName,
        SESSION_TABLE_START_TIME_INDEX_NAME: indexName,
      },
    });

    sessionTable.grantReadWriteData(chatActionFunction);

    const chatActionFunctionUrl = new lambda.CfnUrl(this, 'ChatActionFunctionUrl', {
      authType: lambda.FunctionUrlAuthType.AWS_IAM,
      targetFunctionArn: chatActionFunction.functionArn,
      cors: {
        allowCredentials: false,
        allowHeaders: ['*'],
        allowMethods: ['*'],
        allowOrigins: ['*'],
      },
      invokeMode: 'BUFFERED',
    });

    identityPool.authenticatedRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['lambda:InvokeFunctionUrl'],
        resources: [sendMessageFunctionUrl.attrFunctionArn, chatActionFunctionUrl.attrFunctionArn],
      }),
    );

    new ssm.StringParameter(this, 'ChatActionFunctionUrlParam', {
      parameterName: '/chatbot/endpoints/chat-action',
      stringValue: chatActionFunctionUrl.attrFunctionUrl,
    });

    new ssm.StringParameter(this, 'ChatActionFunctionArnParam', {
      parameterName: '/chatbot/arn/chat-action',
      stringValue: chatActionFunctionUrl.attrFunctionArn,
    });

    new cdk.CfnOutput(this, 'SendMessageFunctionArn', {
      value: sendMessageFunction.functionArn,
    });

    new cdk.CfnOutput(this, 'ChatActionFunctionArn', {
      value: chatActionFunction.functionArn,
    });
  }

  createCognito() {
    const userPool = new cognito.UserPool(this, 'UserPool', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      selfSignUpEnabled: false,
      autoVerify: { email: true, phone: true },
      signInAliases: {
        email: true,
      },
    });

    const userPoolClient = userPool.addClient('UserPoolClient', {
      generateSecret: false,
      authFlows: {
        adminUserPassword: true,
        userPassword: true,
        userSrp: true,
      },
    });

    const identityPool = new idpool.IdentityPool(this, 'IdentityPool', {
      allowUnauthenticatedIdentities: true,
      authenticationProviders: {
        userPools: [new idpool.UserPoolAuthenticationProvider({ userPool, userPoolClient })],
      },
    });

    new ssm.StringParameter(this, 'UserPoolId', {
      parameterName: '/chatbot/cognito/user-pool-id',
      stringValue: userPool.userPoolId,
    });

    new ssm.StringParameter(this, 'UserPoolClientId', {
      parameterName: '/chatbot/cognito/user-pool-client-id',
      stringValue: userPoolClient.userPoolClientId,
    });

    new ssm.StringParameter(this, 'IdentityPoolId', {
      parameterName: '/chatbot/cognito/identity-pool-id',
      stringValue: identityPool.identityPoolId,
    });

    return { userPool, userPoolClient, identityPool };
  }
}
