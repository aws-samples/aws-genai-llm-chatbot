import * as path from 'path';

import * as cdk from 'aws-cdk-lib';
import * as cf from 'aws-cdk-lib/aws-cloudfront';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';

interface UserInterfaceProps extends cdk.NestedStackProps {
  userPoolId: string;
  userPoolClientId: string;
  identityPoolId: string;
  webSocketApiUrl: string;
  architecture: lambda.Architecture;
  dataBucket?: s3.Bucket;
}

export class UserInterface extends Construct {
  public distributionDomainName: string;

  constructor(scope: Construct, id: string, props: UserInterfaceProps) {
    super(scope, id);

    const { userPoolId, userPoolClientId, identityPoolId, webSocketApiUrl, dataBucket, architecture } = props;
    const appPath = path.join(__dirname, '.', 'react');

    const websiteBucket = new s3.Bucket(this, 'Bucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html',
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
    });

    const originAccessIdentity = new cf.OriginAccessIdentity(this, 'S3OAI');
    websiteBucket.grantRead(originAccessIdentity);

    const distribution = new cf.CloudFrontWebDistribution(this, 'Distirbution', {
      viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      priceClass: cf.PriceClass.PRICE_CLASS_ALL,
      httpVersion: cf.HttpVersion.HTTP2_AND_3,
      originConfigs: [
        {
          behaviors: [{ isDefaultBehavior: true }],
          s3OriginSource: {
            s3BucketSource: websiteBucket,
            originAccessIdentity,
          },
        },
      ],
      errorConfigurations: [
        {
          errorCode: 404,
          errorCachingMinTtl: 0,
          responseCode: 200,
          responsePagePath: '/index.html',
        },
      ],
    });

    this.distributionDomainName = distribution.distributionDomainName;

    const webappAssets = s3deploy.Source.asset(appPath, {
      bundling: {
        image: lambda.Runtime.NODEJS_18_X.bundlingImage,
        platform: architecture.dockerPlatform,
        command: ['sh', '-c', ['npm --cache /tmp/.npm install', `npm --cache /tmp/.npm run build`, 'cp -aur /asset-input/dist/* /asset-output/'].join(' && ')],
      },
    });

    let awsExports: object = {
      aws_project_region: cdk.Aws.REGION,
      aws_cognito_region: cdk.Aws.REGION,
      aws_user_pools_id: userPoolId,
      aws_user_pools_web_client_id: userPoolClientId,
      identityPoolId: identityPoolId,
      client: {
        websocket: {
          endpoint: webSocketApiUrl,
        },
      },
    };

    if (dataBucket) {
      awsExports = {
        ...awsExports,
        Storage: {
          AWSS3: {
            bucket: dataBucket.bucketName,
            region: cdk.Aws.REGION,
          },
        },
      };
    }

    const awsExportsAsset = s3deploy.Source.jsonData('aws-exports.json', awsExports);

    new s3deploy.BucketDeployment(this, 'AwsExportsDepolyment', {
      sources: [webappAssets, awsExportsAsset],
      retainOnDelete: false,
      destinationBucket: websiteBucket,
      distribution,
    });

    new cdk.CfnOutput(this, 'UserInterfaceUrl', {
      value: `https://${distribution.distributionDomainName}`,
    });
  }
}
