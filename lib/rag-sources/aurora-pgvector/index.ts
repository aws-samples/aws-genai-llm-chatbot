import * as path from 'path';

import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as python from '@aws-cdk/aws-lambda-python-alpha';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as sagemaker from 'aws-cdk-lib/aws-sagemaker';
import * as cr from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';

import { DocumentIndexing } from './document-indexing';
import { SageMakerModel, DeploymentType } from '../../sagemaker-model';

import { Layer } from '../../layer';

export enum PGVectorIndexType {
  COSINE = 'cosine',
  L2 = 'l2',
  INNER = 'inner',
}

export interface AuroraPgVectorProps extends cdk.NestedStackProps {
  vpc: ec2.Vpc;
  dataBucket: s3.Bucket;
  architecture: lambda.Architecture;
  runtime: lambda.Runtime;
  /**
  https://github.com/pgvector/pgvector

  DO NOT ADD INDEX IF YOU WANT TO USE EXACT NEAREST NEIGHBOR SEARCH

  By default, pgvector performs exact nearest neighbor search, which provides perfect recall.
  You can add an index to use approximate nearest neighbor search, which trades some recall for performance. 
  Unlike typical indexes, you will see different results for queries after adding an approximate index.
  **/
  indexTypes?: PGVectorIndexType[];
}

export class AuroraPgVector extends Construct {
  public api: apigateway.LambdaRestApi;
  public semanticSearchApi: lambda.DockerImageFunction;
  public ingestionQueue: sqs.Queue;

  constructor(scope: Construct, id: string, props: AuroraPgVectorProps) {
    super(scope, id);

    const { vpc, architecture, runtime, indexTypes = [] } = props;

    let dataBucket = props.dataBucket;
    if (!dataBucket) {
      dataBucket = new s3.Bucket(this, 'DataBucket', {
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        autoDeleteObjects: true,
      });
    }

    const { dbCluster } = this.createVectorDB({
      vpc,
      indexTypes,
      architecture,
    });
    const { embeddingsEndpoint } = this.createEmbeddingsEndpoint({ vpc });
    const documentIndexing = new DocumentIndexing(this, 'DocumentIndexing', {
      vpc,
      dbCluster,
      embeddingsEndpoint,
      dataBucket,
    });
    this.ingestionQueue = documentIndexing.ingestionQueue;

    this.createAPI({
      vpc,
      dbCluster,
      embeddingsEndpoint: embeddingsEndpoint,
      runtime,
      architecture,
    });
  }

  private createVectorDB({
    vpc,
    indexTypes,
    architecture,
  }: {
    vpc: ec2.Vpc;
    indexTypes: PGVectorIndexType[];
    architecture: lambda.Architecture;
  }) {
    const dbCluster = new rds.DatabaseCluster(this, 'AuroraDatabase', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_15_3,
      }),
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      writer: rds.ClusterInstance.serverlessV2('ServerlessInstance'),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
    });

    const databaseSetupFunction = new lambda.DockerImageFunction(
      this,
      'DatabaseSetupFunction',
      {
        code: lambda.DockerImageCode.fromImageAsset(
          path.join(__dirname, './functions/vectordb-setup')
        ),
        architecture,
        timeout: cdk.Duration.minutes(5),
        memorySize: 1024,
        vpc: vpc,
        logRetention: logs.RetentionDays.ONE_WEEK,
      }
    );

    dbCluster.secret?.grantRead(databaseSetupFunction);
    dbCluster.connections.allowDefaultPortFrom(databaseSetupFunction);

    const databaseSetupProvider = new cr.Provider(
      this,
      'DatabaseSetupProvider',
      {
        vpc,
        onEventHandler: databaseSetupFunction,
      }
    );

    const dbSetupResource = new cdk.CustomResource(
      this,
      'DatabaseSetupResource',
      {
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        serviceToken: databaseSetupProvider.serviceToken,
        properties: {
          DB_SECRET_ID: dbCluster.secret?.secretArn as string,
          INDEX_TYPES: indexTypes.join(','),
        },
      }
    );

    dbSetupResource.node.addDependency(dbCluster);

    return { dbCluster };
  }

  private createEmbeddingsEndpoint({ vpc }: { vpc: ec2.Vpc }) {
    const embeddingsModel = new SageMakerModel(this, 'EmbeddingsModel', {
      vpc,
      region: cdk.Aws.REGION,
      model: {
        type: DeploymentType.CustomInferenceScript,
        modelId: [
          'sentence-transformers/all-MiniLM-L6-v2',
          'cross-encoder/ms-marco-MiniLM-L-12-v2',
        ],
        codeFolder: path.join(__dirname, './embeddings-model'),
        instanceType: 'ml.g4dn.xlarge',
      },
    });

    return { embeddingsEndpoint: embeddingsModel.endpoint };
  }

  private createAPI({
    vpc,
    dbCluster,
    embeddingsEndpoint,
    runtime,
    architecture,
  }: {
    vpc: ec2.Vpc;
    dbCluster: rds.DatabaseInstance | rds.DatabaseCluster;
    embeddingsEndpoint: sagemaker.CfnEndpoint;
    runtime: lambda.Runtime;
    architecture: lambda.Architecture;
  }) {
    const semanticSearchApi = new lambda.DockerImageFunction(
      this,
      'SemanticSearchApi',
      {
        code: lambda.DockerImageCode.fromImageAsset(
          path.join(__dirname, './functions/semantic-search-api')
        ),
        architecture,
        vpc,
        timeout: cdk.Duration.minutes(1),
        memorySize: 1024,
        logRetention: logs.RetentionDays.ONE_DAY,
        environment: {
          REGION_NAME: cdk.Aws.REGION,
          LOG_LEVEL: 'DEBUG',
          DB_SECRET_ID: dbCluster.secret?.secretArn as string,
          EMBEDDINGS_ENDPOINT_NAME: embeddingsEndpoint.attrEndpointName,
          CROSS_ENCODER_ENDPOINT_NAME: embeddingsEndpoint.attrEndpointName,
        },
      }
    );

    dbCluster.secret?.grantRead(semanticSearchApi);
    dbCluster.connections.allowDefaultPortFrom(semanticSearchApi);

    semanticSearchApi.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['sagemaker:InvokeEndpoint'],
        resources: [embeddingsEndpoint.ref],
      })
    );

    this.semanticSearchApi = semanticSearchApi;

    new cdk.CfnOutput(this, 'SemanticSearchApiFunctionArn', {
      value: semanticSearchApi.functionArn,
    });

    const commonLayer = new Layer(this, 'CommonLayer', {
      runtime,
      architecture,
      path: path.join(__dirname, './layers/common'),
    });

    const apiHandler = new python.PythonFunction(this, 'ApiHandler', {
      entry: path.join(__dirname, './functions/api-handler'),
      runtime,
      architecture,
      tracing: lambda.Tracing.ACTIVE,
      memorySize: 512,
      timeout: cdk.Duration.minutes(1),
      layers: [commonLayer.layer],
      vpc,
      environment: {
        REGION_NAME: cdk.Aws.REGION,
        LOG_LEVEL: 'DEBUG',
        DB_SECRET_ID: dbCluster.secret?.secretArn as string,
        EMBEDDINGS_ENDPOINT_NAME: embeddingsEndpoint.attrEndpointName,
        CROSS_ENCODER_ENDPOINT_NAME: embeddingsEndpoint.attrEndpointName,
      },
    });

    dbCluster.secret?.grantRead(apiHandler);
    dbCluster.connections.allowDefaultPortFrom(apiHandler);

    apiHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['sagemaker:InvokeEndpoint'],
        resources: [embeddingsEndpoint.ref],
      })
    );

    const api = new apigateway.LambdaRestApi(this, 'AuroraPgVectorApi2', {
      handler: apiHandler,
      endpointConfiguration: {
        types: [apigateway.EndpointType.REGIONAL],
      },
      defaultMethodOptions: {
        authorizationType: apigateway.AuthorizationType.IAM,
      },
    });

    this.api = api;
  }
}
