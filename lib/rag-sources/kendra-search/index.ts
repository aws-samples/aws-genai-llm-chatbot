import * as path from 'path';

import * as python from '@aws-cdk/aws-lambda-python-alpha';
import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kendra from 'aws-cdk-lib/aws-kendra';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

import { Layer } from '../../layer';

export interface KendraSearchProps extends cdk.NestedStackProps {
  dataBucket: s3.Bucket;
  architecture: lambda.Architecture;
  runtime: lambda.Runtime;
  vpc: ec2.Vpc;
}

export class KendraSearch extends Construct {
  public semanticSearchApi: lambda.DockerImageFunction;
  public index: kendra.CfnIndex;
  public ingestionQueue: sqs.Queue;
  public api: apigateway.LambdaRestApi;

  constructor(scope: Construct, id: string, props: KendraSearchProps) {
    super(scope, id);

    let dataBucket = props.dataBucket;

    const { architecture, runtime, vpc } = props;

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

    const ingestionQueueDlq = new sqs.Queue(this, 'IngestionQueueDlq');
    const ingestionQueue = new sqs.Queue(this, 'IngestionQueue', {
      deadLetterQueue: {
        maxReceiveCount: 3,
        queue: ingestionQueueDlq,
      },
    });

    const kendraRole = new iam.Role(this, 'KendraRole', {
      assumedBy: new iam.ServicePrincipal('kendra.amazonaws.com'),
    });

    kendraRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['logs:*', 'cloudwatch:*'],
        resources: ['*'],
      }),
    );
    dataBucket.grantRead(kendraRole);

    const indexName = 'semantic-search';
    const index = new kendra.CfnIndex(this, 'Index', {
      edition: 'DEVELOPER_EDITION',
      name: indexName,
      roleArn: kendraRole.roleArn,
    });

    // Create Kendra S3 Data Source
    const s3DataSource = new kendra.CfnDataSource(this, 'KendraS3DataSource', {
      type: 'S3',
      name: 'KendraS3DataSource',
      indexId: index.ref,
      description: 'S3 Data Source for Kendra Index',
      dataSourceConfiguration: {
        s3Configuration: {
          bucketName: dataBucket.bucketName,
        },
      },
      roleArn: kendraRole.roleArn,
    });

    // allow kendra role to BatchDeleteDocument
    kendraRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['kendra:BatchDeleteDocument'],
        resources: [index.attrArn, s3DataSource.attrArn],
      }),
    );

    const apiHandler = new python.PythonFunction(this, 'ApiHandler', {
      entry: path.join(__dirname, './functions/api-handler'),
      runtime,
      architecture,
      timeout: cdk.Duration.seconds(30),
      tracing: lambda.Tracing.ACTIVE,
      layers: [commonLayer.layer],
      environment: {
        KENDRA_INDEX_ID: index.ref,
        KENDRA_LANGUAGE_CODE: 'en',
      },
    });

    apiHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['kendra:Retrieve', 'kendra:Query'],
        resources: [index.attrArn],
      }),
    );

    const api = new apigateway.LambdaRestApi(this, 'KendraSearchApi2', {
      handler: apiHandler,
      endpointConfiguration: {
        types: [apigateway.EndpointType.REGIONAL],
      },
      defaultMethodOptions: {
        authorizationType: apigateway.AuthorizationType.IAM,
      },
    });

    const documentIndexing = new python.PythonFunction(this, 'DocumentIndexing', {
      entry: path.join(__dirname, './functions/document-indexing'),
      runtime,
      architecture,
      tracing: lambda.Tracing.ACTIVE,
      layers: [commonLayer.layer],
      environment: {
        KENDRA_INDEX_ID: index.ref,
        KENDRA_DATA_SOURCE_ID: s3DataSource.attrId,
      },
    });
    // allow the document indexing function to start sync jobs
    documentIndexing.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['kendra:StartDataSourceSyncJob', 'kendra:BatchDeleteDocument'],
        resources: [index.attrArn, s3DataSource.attrArn],
      }),
    );

    documentIndexing.addEventSource(new lambdaEventSources.SqsEventSource(ingestionQueue));

    this.ingestionQueue = ingestionQueue;
    this.index = index;
    this.api = api;
  }
}
