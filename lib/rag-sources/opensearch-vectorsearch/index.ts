import * as path from 'path';

import * as python from '@aws-cdk/aws-lambda-python-alpha';
import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as opensearchserverless from 'aws-cdk-lib/aws-opensearchserverless';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as cr from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';

import { Layer } from '../../layer';

export interface OpenSearchVectorSearchProps extends cdk.NestedStackProps {
  vpc: ec2.Vpc;
  dataBucket: s3.Bucket;
  indexName: string;
  dimension: number;
  collectionName: string;
  architecture: lambda.Architecture;
  runtime: lambda.Runtime;
  bedrockRegion: string;
  bedrockEndpointUrl: string;
}

export class OpenSearchVectorSearch extends Construct {
  public api: apigateway.LambdaRestApi;
  public ingestionQueue: sqs.Queue;
  public indexName: string;
  public dimension: number;
  public collectionName: string;

  constructor(scope: Construct, id: string, props: OpenSearchVectorSearchProps) {
    super(scope, id);

    const { vpc, indexName, dimension, collectionName, architecture, runtime, bedrockRegion, bedrockEndpointUrl } = props;

    let dataBucket = props.dataBucket;

    if (!dataBucket) {
      dataBucket = new s3.Bucket(this, 'DataBucket', {
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        autoDeleteObjects: true,
      });
    }

    const commonLayer = new Layer(this, 'CommonLayer', {
      runtime,
      architecture,
      path: path.join(__dirname, './layers/common'),
    });

    const indexDocumentRole = new iam.Role(this, 'indexDocumentRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'), iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole')],
    });

    const createIndexRole = new iam.Role(this, 'CreateIndexRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'), iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole')],
    });

    const apiHandlerRole = new iam.Role(this, 'ApiHandlerRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'), iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole')],
    });

    // Add Amazon Bedrock permissions to the IAM role for the Lambda function
    apiHandlerRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:*'],
        resources: ['*'],
      }),
    );

    // create a security group for the VPC endpoint and lambda function to access the collection in the VPC
    const sg = new ec2.SecurityGroup(this, 'SecurityGroup', {
      vpc,
    });
    sg.addIngressRule(ec2.Peer.ipv4(vpc.vpcCidrBlock), ec2.Port.tcp(443));

    const cfnVpcEndpoint = new opensearchserverless.CfnVpcEndpoint(this, 'VpcEndpoint', {
      name: `${collectionName}-vpce`.slice(0, 32), // maxLength: 32
      subnetIds: vpc.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      }).subnetIds,
      vpcId: vpc.vpcId,
      securityGroupIds: [sg.securityGroupId],
    });

    const cfnNetworkSecurityPolicy = new opensearchserverless.CfnSecurityPolicy(this, 'NetworkSecurityPolicy', {
      name: `${collectionName}-network-policy`.slice(0, 32), // maxLength: 32
      type: 'network',
      policy: JSON.stringify([
        {
          Rules: [{ ResourceType: 'collection', Resource: [`collection/${collectionName}`] }],
          AllowFromPublic: false,
          SourceVPCEs: [cfnVpcEndpoint.attrId],
        },
      ]).replace(/(\r\n|\n|\r)/gm, ''),
    });
    cfnNetworkSecurityPolicy.node.addDependency(cfnVpcEndpoint);

    const cfnEncryptionSecurityPolicy = new opensearchserverless.CfnSecurityPolicy(this, 'EncryptionSecurityPolicy', {
      name: `${collectionName}-encryption-policy`.slice(0, 32), // maxLength: 32
      type: 'encryption',
      policy: JSON.stringify({
        Rules: [{ ResourceType: 'collection', Resource: [`collection/${collectionName}`] }],
        AWSOwnedKey: true,
      }).replace(/(\r\n|\n|\r)/gm, ''),
    });

    cfnEncryptionSecurityPolicy.node.addDependency(cfnNetworkSecurityPolicy);

    const cfnAccessPolicy = new opensearchserverless.CfnAccessPolicy(this, 'AccessPolicy', {
      name: `${collectionName}-access-policy`.slice(0, 32), // maxLength: 32
      type: 'data',
      policy: JSON.stringify([
        {
          Rules: [{ ResourceType: 'index', Resource: [`index/${collectionName}/*`], Permission: ['aoss:CreateIndex', 'aoss:DeleteIndex', 'aoss:UpdateIndex', 'aoss:DescribeIndex'] }],
          Principal: [createIndexRole.roleArn],
        },
        {
          Rules: [{ ResourceType: 'index', Resource: [`index/${collectionName}/*`], Permission: ['aoss:ReadDocument', 'aoss:WriteDocument'] }],
          Principal: [indexDocumentRole.roleArn],
        },
        {
          Rules: [{ ResourceType: 'index', Resource: [`index/${collectionName}/*`], Permission: ['aoss:ReadDocument'] }],
          Principal: [apiHandlerRole.roleArn],
        },
      ]).replace(/(\r\n|\n|\r)/gm, ''),
    });

    const cfnCollection = new opensearchserverless.CfnCollection(this, 'OpenSearchCollection', {
      name: `${collectionName}`.slice(0, 32), // maxLength: 32
      type: 'VECTORSEARCH',
    });
    cfnCollection.node.addDependency(cfnAccessPolicy);
    cfnCollection.node.addDependency(cfnNetworkSecurityPolicy);
    cfnCollection.node.addDependency(cfnEncryptionSecurityPolicy);

    // INGESTION
    const ingestionQueueDlq = new sqs.Queue(this, 'IngestionQueueDLQ', {
      visibilityTimeout: cdk.Duration.minutes(5 * 6),
    });

    const ingestionQueue = new sqs.Queue(this, 'IngestionQueue', {
      visibilityTimeout: cdk.Duration.minutes(5 * 6),
      deadLetterQueue: {
        maxReceiveCount: 3,
        queue: ingestionQueueDlq,
      },
    });

    const indexDocument = new lambda.DockerImageFunction(this, 'IndexDocument', {
      code: lambda.DockerImageCode.fromImageAsset(path.join(__dirname, './functions/index-document')),
      architecture,
      tracing: lambda.Tracing.ACTIVE,
      timeout: cdk.Duration.minutes(5),
      role: indexDocumentRole,
      memorySize: 3072,
      vpc,
      securityGroups: [ec2.SecurityGroup.fromSecurityGroupId(this, 'IndexDocumentSG', sg.securityGroupId)],
      vpcSubnets: vpc.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      }),
      environment: {
        AOSS_COLLECTION_ENDPOINT: cfnCollection.attrCollectionEndpoint,
        AOSS_COLLECTION_ENDPOINT_PORT: '443',
        AOSS_INDEX_NAME: indexName,
        AOSS_EMBEDDINGS_DIMENSION: `${dimension}`,
        BEDROCK_REGION: bedrockRegion,
        BEDROCK_ENDPOINT_URL: bedrockEndpointUrl,
      },
    });
    indexDocumentRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['aoss:APIAccessAll'],
        resources: [cfnCollection.attrArn],
      }),
    );
    dataBucket.grantRead(indexDocument);
    indexDocument.addEventSource(new lambdaEventSources.SqsEventSource(ingestionQueue));

    // Add Amazon Bedrock permissions to the IAM role for the Lambda function
    indexDocumentRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:*'],
        resources: ['*'],
      }),
    );

    const apiHandler = new python.PythonFunction(this, 'ApiHandler', {
      entry: path.join(__dirname, './functions/api-handler'),
      runtime,
      role: apiHandlerRole,
      architecture,
      tracing: lambda.Tracing.ACTIVE,
      memorySize: 512,
      timeout: cdk.Duration.minutes(1),
      layers: [commonLayer.layer],
      vpc,
      securityGroups: [ec2.SecurityGroup.fromSecurityGroupId(this, 'APIHandlerSG', sg.securityGroupId)],
      vpcSubnets: vpc.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      }),
      environment: {
        AOSS_COLLECTION_ENDPOINT: cfnCollection.attrCollectionEndpoint,
        AOSS_COLLECTION_ENDPOINT_PORT: '443',
        AOSS_INDEX_NAME: indexName,
        AOSS_EMBEDDINGS_DIMENSION: `${dimension}`,
        BEDROCK_REGION: bedrockRegion,
        BEDROCK_ENDPOINT_URL: bedrockEndpointUrl,
      },
    });
    apiHandlerRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['aoss:APIAccessAll'],
        resources: [cfnCollection.attrArn],
      }),
    );

    const createIndex = new python.PythonFunction(this, 'CreateIndex', {
      entry: path.join(__dirname, './functions/create-index'),
      runtime,
      role: createIndexRole,
      architecture,
      timeout: cdk.Duration.minutes(5),
      tracing: lambda.Tracing.ACTIVE,
      layers: [commonLayer.layer],
      vpc,
      securityGroups: [ec2.SecurityGroup.fromSecurityGroupId(this, 'CreateIndexSG', sg.securityGroupId)],
      vpcSubnets: vpc.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      }),
    });
    createIndexRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['aoss:APIAccessAll', 'aoss:DescribeIndex', 'aoss:CreateIndex'],
        resources: [cfnCollection.attrArn],
      }),
    );
    const createIndexProvider = new cr.Provider(this, 'CreateIndexProvider', {
      vpc,
      onEventHandler: createIndex,
    });

    new cdk.CustomResource(this, 'CreateIndexResource', {
      serviceToken: createIndexProvider.serviceToken,
      properties: {
        IndexName: indexName,
        Endpoint: cfnCollection.attrCollectionEndpoint,
        Dimension: `${dimension}`,
        VectorField: 'vector_field',
        Port: '443',
      },
    });

    const api = new apigateway.LambdaRestApi(this, 'OpenSearchVectorSearchApi2', {
      handler: apiHandler,
      endpointConfiguration: {
        types: [apigateway.EndpointType.REGIONAL],
      },
      defaultMethodOptions: {
        authorizationType: apigateway.AuthorizationType.IAM,
      },
    });

    this.ingestionQueue = ingestionQueue;
    this.api = api;
  }
}
