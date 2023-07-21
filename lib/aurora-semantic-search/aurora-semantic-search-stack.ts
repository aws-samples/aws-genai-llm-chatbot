import * as path from 'path';

import * as cdk from 'aws-cdk-lib';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as sagemaker from 'aws-cdk-lib/aws-sagemaker';
import * as cr from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';

import { DocumentIndexingStack } from './document-indexing-stack';
import { HuggingFaceCustomScriptModel } from '../large-language-model/hf-custom-script-model';

export enum PGVectorIndexType {
  COSINE = 'cosine',
  L2 = 'l2',
  INNER = 'inner',
}

export interface AuroraSemanticSearchStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  /**
  https://github.com/pgvector/pgvector

  DO NOT ADD INDEX IF YOU WANT TO USE EXACT NEAREST NEIGHBOR SEARCH

  By default, pgvector performs exact nearest neighbor search, which provides perfect recall.
  You can add an index to use approximate nearest neighbor search, which trades some recall for performance. 
  Unlike typical indexes, you will see different results for queries after adding an approximate index.
  **/
  indexTypes?: PGVectorIndexType[];
}

export class AuroraSemanticSearchStack extends cdk.Stack {
  public semanticSearchApi: lambda.DockerImageFunction;

  constructor(
    scope: Construct,
    id: string,
    props: AuroraSemanticSearchStackProps
  ) {
    super(scope, id, props);

    const { vpc, indexTypes = [] } = props;

    const { dbCluster } = this.createVectorDB({ vpc, indexTypes });
    const { embeddingsEndpoint } = this.createEmbeddingsEndpoint({ vpc });
    new DocumentIndexingStack(this, 'DocumentIndexingStack', {
      vpc,
      dbCluster,
      embeddingsEndpoint,
    });

    this.createAPI({ vpc, dbCluster, embeddingsEndpoint: embeddingsEndpoint });
  }

  private createVectorDB({
    vpc,
    indexTypes,
  }: {
    vpc: ec2.Vpc;
    indexTypes: PGVectorIndexType[];
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
        architecture: lambda.Architecture.X86_64,
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
    const embeddingsModel = new HuggingFaceCustomScriptModel(
      this,
      'EmbeddingsModel',
      {
        vpc,
        region: this.region,
        modelId: [
          'sentence-transformers/all-MiniLM-L6-v2',
          'cross-encoder/ms-marco-MiniLM-L-12-v2',
        ],
        codeFolder: './lib/aurora-semantic-search/embeddings-model',
        instanceType: 'ml.g4dn.xlarge',
        codeBuildComputeType: codebuild.ComputeType.LARGE,
      }
    );

    return { embeddingsEndpoint: embeddingsModel.endpoint };
  }

  private createAPI({
    vpc,
    dbCluster,
    embeddingsEndpoint,
  }: {
    vpc: ec2.Vpc;
    dbCluster: rds.DatabaseInstance | rds.DatabaseCluster;
    embeddingsEndpoint: sagemaker.CfnEndpoint;
  }) {
    const semanticSearchApi = new lambda.DockerImageFunction(
      this,
      'SemanticSearchApi',
      {
        code: lambda.DockerImageCode.fromImageAsset(
          path.join(__dirname, './functions/semantic-search-api')
        ),
        architecture: lambda.Architecture.X86_64,
        vpc,
        timeout: cdk.Duration.minutes(1),
        memorySize: 1024,
        logRetention: logs.RetentionDays.ONE_DAY,
        environment: {
          REGION_NAME: this.region,
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
  }
}
