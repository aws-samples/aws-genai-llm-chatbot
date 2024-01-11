import * as apigwv2 from "@aws-cdk/aws-apigatewayv2-alpha";
import * as cognitoIdentityPool from "@aws-cdk/aws-cognito-identitypool-alpha";
import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as cf from "aws-cdk-lib/aws-cloudfront";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import { Construct } from "constructs";
import {
  ExecSyncOptionsWithBufferEncoding,
  execSync,
} from "node:child_process";
import * as path from "node:path";
import { Shared } from "../shared";
import { SystemConfig } from "../shared/types";
import { Utils } from "../shared/utils";

export interface UserInterfaceProps {
  readonly config: SystemConfig;
  readonly shared: Shared;
  readonly userPoolId: string;
  readonly userPoolClientId: string;
  readonly identityPool: cognitoIdentityPool.IdentityPool;
  readonly restApi: apigateway.RestApi;
  readonly webSocketApi: apigwv2.WebSocketApi;
  readonly chatbotFilesBucket: s3.Bucket;
  readonly crossEncodersEnabled: boolean;
  readonly sagemakerEmbeddingsEnabled: boolean;
}

export class UserInterface extends Construct {
  constructor(scope: Construct, id: string, props: UserInterfaceProps) {
    super(scope, id);

    const appPath = path.join(__dirname, "react-app");
    const buildPath = path.join(appPath, "dist");

    const websiteBucket = new s3.Bucket(this, "WebsiteBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      autoDeleteObjects: true,
      websiteIndexDocument: "index.html",
      websiteErrorDocument: "index.html",
    });

    const originAccessIdentity = new cf.OriginAccessIdentity(this, "S3OAI");
    websiteBucket.grantRead(originAccessIdentity);
    props.chatbotFilesBucket.grantRead(originAccessIdentity);

    const distribution = new cf.CloudFrontWebDistribution(
      this,
      "Distirbution",
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
          {
            behaviors: [
              {
                pathPattern: "/api/*",
                allowedMethods: cf.CloudFrontAllowedMethods.ALL,
                viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                defaultTtl: cdk.Duration.seconds(0),
                forwardedValues: {
                  queryString: true,
                  headers: [
                    "Referer",
                    "Origin",
                    "Authorization",
                    "Content-Type",
                    "x-forwarded-user",
                    "Access-Control-Request-Headers",
                    "Access-Control-Request-Method",
                  ],
                },
              },
            ],
            customOriginSource: {
              domainName: `${props.restApi.restApiId}.execute-api.${cdk.Aws.REGION}.${cdk.Aws.URL_SUFFIX}`,
              originHeaders: {
                "X-Origin-Verify": props.shared.xOriginVerifySecret
                  .secretValueFromJson("headerValue")
                  .unsafeUnwrap(),
              },
            },
          },
          {
            behaviors: [
              {
                pathPattern: "/socket",
                allowedMethods: cf.CloudFrontAllowedMethods.ALL,
                viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                forwardedValues: {
                  queryString: true,
                  headers: [
                    "Sec-WebSocket-Key",
                    "Sec-WebSocket-Version",
                    "Sec-WebSocket-Protocol",
                    "Sec-WebSocket-Accept",
                    "Sec-WebSocket-Extensions",
                  ],
                },
              },
            ],
            customOriginSource: {
              domainName: `${props.webSocketApi.apiId}.execute-api.${cdk.Aws.REGION}.${cdk.Aws.URL_SUFFIX}`,
              originHeaders: {
                "X-Origin-Verify": props.shared.xOriginVerifySecret
                  .secretValueFromJson("headerValue")
                  .unsafeUnwrap(),
              },
            },
          },
          {
            behaviors: [
              {
                pathPattern: "/chabot/files/*",
                allowedMethods: cf.CloudFrontAllowedMethods.ALL,
                viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                defaultTtl: cdk.Duration.seconds(0),
                forwardedValues: {
                  queryString: true,
                  headers: [
                    "Referer",
                    "Origin",
                    "Authorization",
                    "Content-Type",
                    "x-forwarded-user",
                    "Access-Control-Request-Headers",
                    "Access-Control-Request-Method",
                  ],
                },
              },
            ],
            s3OriginSource: {
              s3BucketSource: props.chatbotFilesBucket,
              originAccessIdentity,
            },
          },
        ],
        errorConfigurations: [
          {
            errorCode: 404,
            errorCachingMinTtl: 0,
            responseCode: 200,
            responsePagePath: "/index.html",
          },
        ],
      }
    );

    const exportsAsset = s3deploy.Source.jsonData("aws-exports.json", {
      aws_project_region: cdk.Aws.REGION,
      aws_cognito_region: cdk.Aws.REGION,
      aws_user_pools_id: props.userPoolId,
      aws_user_pools_web_client_id: props.userPoolClientId,
      aws_cognito_identity_pool_id: props.identityPool.identityPoolId,
      Storage: {
        AWSS3: {
          bucket: props.chatbotFilesBucket.bucketName,
          region: cdk.Aws.REGION,
        },
      },
      config: {
        api_endpoint: `https://${distribution.distributionDomainName}/api`,
        websocket_endpoint: `wss://${distribution.distributionDomainName}/socket`,
        rag_enabled: props.config.rag.enabled,
        cross_encoders_enabled: props.crossEncodersEnabled,
        sagemaker_embeddings_enabled: props.sagemakerEmbeddingsEnabled,
        default_embeddings_model: Utils.getDefaultEmbeddingsModel(props.config),
        default_cross_encoder_model: Utils.getDefaultCrossEncoderModel(
          props.config
        ),
      },
    });

    // Allow authenticated web users to read upload data to the attachments bucket for their chat files
    // ref: https://docs.amplify.aws/lib/storage/getting-started/q/platform/js/#using-amazon-s3
    props.identityPool.authenticatedRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
        resources: [
          `${props.chatbotFilesBucket.bucketArn}/public/*`,
          `${props.chatbotFilesBucket.bucketArn}/protected/\${cognito-identity.amazonaws.com:sub}/*`,
          `${props.chatbotFilesBucket.bucketArn}/private/\${cognito-identity.amazonaws.com:sub}/*`,
        ],
      })
    );
    props.identityPool.authenticatedRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["s3:ListBucket"],
        resources: [`${props.chatbotFilesBucket.bucketArn}`],
        conditions: {
          StringLike: {
            "s3:prefix": [
              "public/",
              "public/*",
              "protected/",
              "protected/*",
              "private/${cognito-identity.amazonaws.com:sub}/",
              "private/${cognito-identity.amazonaws.com:sub}/*",
            ],
          },
        },
      })
    );

    // Enable CORS for the attachments bucket to allow uploads from the user interface
    // ref: https://docs.amplify.aws/lib/storage/getting-started/q/platform/js/#amazon-s3-bucket-cors-policy-setup
    props.chatbotFilesBucket.addCorsRule({
      allowedMethods: [
        s3.HttpMethods.GET,
        s3.HttpMethods.PUT,
        s3.HttpMethods.POST,
        s3.HttpMethods.DELETE,
      ],
      allowedOrigins: ["*"],
      allowedHeaders: ["*"],
      exposedHeaders: [
        "x-amz-server-side-encryption",
        "x-amz-request-id",
        "x-amz-id-2",
        "ETag",
      ],
      maxAge: 3000,
    });

    const asset = s3deploy.Source.asset(appPath, {
      bundling: {
        image: cdk.DockerImage.fromRegistry(
          "public.ecr.aws/sam/build-nodejs18.x:latest"
        ),
        command: [
          "sh",
          "-c",
          [
            "npm --cache /tmp/.npm install",
            "npm --cache /tmp/.npm run build",
            "cp -aur /asset-input/dist/* /asset-output/",
          ].join(" && "),
        ],
        local: {
          tryBundle(outputDir: string) {
            try {
              const options: ExecSyncOptionsWithBufferEncoding = {
                stdio: "inherit",
                env: {
                  ...process.env,
                },
              };

              execSync(`npm --silent --prefix "${appPath}" ci`, options);
              execSync(`npm --silent --prefix "${appPath}" run build`, options);
              Utils.copyDirRecursive(buildPath, outputDir);
            } catch (e) {
              console.error(e);
              return false;
            }

            return true;
          },
        },
      },
    });

    new s3deploy.BucketDeployment(this, "UserInterfaceDeployment", {
      prune: false,
      sources: [asset, exportsAsset],
      destinationBucket: websiteBucket,
      distribution,
    });

    // ###################################################
    // Outputs
    // ###################################################
    new cdk.CfnOutput(this, "UserInterfaceDomainName", {
      value: `https://${distribution.distributionDomainName}`,
    });
  }
}
