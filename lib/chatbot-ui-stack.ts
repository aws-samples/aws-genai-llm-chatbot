import {
  ExecSyncOptionsWithBufferEncoding,
  execSync,
} from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as cdk from 'aws-cdk-lib';
import * as cf from 'aws-cdk-lib/aws-cloudfront';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

export interface ChatBotUIStackProps extends cdk.NestedStackProps {
  prefix: string;
}

export class ChatBotUIStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ChatBotUIStackProps) {
    super(scope, id, props);

    const { prefix } = props;

    const appPath = path.join(__dirname, '..', 'chatbot-ui');
    const buildPath = path.join(appPath, 'build');

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

    const distribution = new cf.CloudFrontWebDistribution(
      this,
      'Distirbution',
      {
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
      }
    );

    const exportsAsset = s3deploy.Source.jsonData('aws-exports.json', {
      aws_project_region: this.region,
      aws_cognito_region: this.region,
      aws_user_pools_id: ssm.StringParameter.fromStringParameterName(
        this,
        'UserPoolId',
        `/chatbot/${prefix}/cognito/user-pool-id`
      ).stringValue,
      aws_user_pools_web_client_id: ssm.StringParameter.fromStringParameterName(
        this,
        'UserPoolClientId',
        `/chatbot/${prefix}/cognito/user-pool-client-id`
      ).stringValue,
      identityPoolId: ssm.StringParameter.fromStringParameterName(
        this,
        'IdentityPoolId',
        `/chatbot/${prefix}/cognito/identity-pool-id`
      ).stringValue,
      client: {
        name: 'lambda',
        send_endpoint: ssm.StringParameter.fromStringParameterName(
          this,
          'ChatBotEndpointSend',
          `/chatbot/${prefix}/endpoints/send-message`
        ).stringValue,
        action_endpoint: ssm.StringParameter.fromStringParameterName(
          this,
          'ChatBotEndpointAction',
          `/chatbot/${prefix}/endpoints/chat-action`
        ).stringValue,
      },
    });

    const asset = s3deploy.Source.asset(appPath, {
      bundling: {
        image: cdk.DockerImage.fromRegistry(
          'public.ecr.aws/sam/build-nodejs18.x:latest'
        ),
        // eslint-disable-next-line prettier/prettier
        command: [
          'sh',
          '-c',
          [
            'npm --cache /tmp/.npm install',
            `npm --cache /tmp/.npm run build`,
            'cp -aur /asset-input/build/* /asset-output/',
          ].join(' && '),
        ],
        local: {
          tryBundle(outputDir: string) {
            try {
              const options: ExecSyncOptionsWithBufferEncoding = {
                stdio: 'inherit',
                env: {
                  ...process.env,
                },
              };

              execSync(`npm --silent --prefix "${appPath}" ci`, options);
              execSync(`npm --silent --prefix "${appPath}" run build`, options);
              copyDirRecursive(buildPath, outputDir);
            } catch (e) {
              console.error(e);
              return false;
            }

            return true;
          },
        },
      },
    });

    new s3deploy.BucketDeployment(this, 'ChatBotUIDeployment', {
      // sources: [asset],
      sources: [asset, exportsAsset],
      destinationBucket: websiteBucket,
      distribution,
    });

    // ###################################################
    // Outputs
    // ###################################################
    new cdk.CfnOutput(this, 'DomainName', {
      value: distribution.distributionDomainName,
    });
  }
}

function copyDirRecursive(sourceDir: string, targetDir: string): void {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir);
  }

  const files = fs.readdirSync(sourceDir);

  for (const file of files) {
    const sourceFilePath = path.join(sourceDir, file);
    const targetFilePath = path.join(targetDir, file);
    const stats = fs.statSync(sourceFilePath);

    if (stats.isDirectory()) {
      copyDirRecursive(sourceFilePath, targetFilePath);
    } else {
      fs.copyFileSync(sourceFilePath, targetFilePath);
    }
  }
}
