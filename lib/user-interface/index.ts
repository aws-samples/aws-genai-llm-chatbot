import * as cognitoIdentityPool from "@aws-cdk/aws-cognito-identitypool-alpha";
import * as cdk from "aws-cdk-lib";
import * as cf from "aws-cdk-lib/aws-cloudfront";
import { S3Origin } from "aws-cdk-lib/aws-cloudfront-origins";
import { HttpOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
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
import { ChatBotApi } from "../chatbot-api";

export interface UserInterfaceProps {
  readonly config: SystemConfig;
  readonly shared: Shared;
  readonly userPoolId: string;
  readonly userPoolClientId: string;
  readonly identityPool: cognitoIdentityPool.IdentityPool;
  readonly api: ChatBotApi;
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
    });

    const originAccessControl = new cf.CfnOriginAccessControl(
      this,
      "OriginAccessControl",
      {
        originAccessControlConfig: {
          signingBehavior: "always",
          signingProtocol: "sigv4",
          originAccessControlOriginType: "s3",
          name: "UserInterfaceOriginAccessControl",
        },
      }
    );

    const responseHeadersPolicy = new cf.ResponseHeadersPolicy(
      this,
      "ResponseHeadersPolicyCors",
      {
        comment: "A default CORS policy",
        corsBehavior: {
          accessControlAllowCredentials: false,
          accessControlAllowHeaders: ["*"],
          accessControlAllowMethods: ["ALL"],
          accessControlAllowOrigins: [
            "https://localhost:3000",
            "http://localhost:3000",
          ],
          accessControlExposeHeaders: ["*"],
          accessControlMaxAge: cdk.Duration.seconds(600),
          originOverride: true,
        },
        securityHeadersBehavior: {
          contentSecurityPolicy: {
            contentSecurityPolicy: "default-src 'self';",
            override: true,
          },
          contentTypeOptions: { override: false },
          frameOptions: {
            frameOption: cf.HeadersFrameOption.DENY,
            override: true,
          },
          referrerPolicy: {
            referrerPolicy:
              cf.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
            override: true,
          },
        },
        removeHeaders: ["Server", "X-Powered-By"],
        serverTimingSamplingRate: 50,
      }
    );

    const originRequestPolicy = new cf.OriginRequestPolicy(
      this,
      "OriginRequestPolicy",
      {
        headerBehavior: cf.OriginRequestHeaderBehavior.allowList(
          "Origin",
          "Referer",
          "Access-Control-Request-Method",
          "Access-Control-Request-Headers",
          "Content-Type",
          "Sec-WebSocket-Key",
          "Sec-WebSocket-Version",
          "Sec-WebSocket-Protocol",
          "Sec-WebSocket-Accept",
          "Sec-WebSocket-Extensions"
        ),
        queryStringBehavior: cf.OriginRequestQueryStringBehavior.all(),
        cookieBehavior: cf.OriginRequestCookieBehavior.all(),
      }
    );

    const appSyncOrigin = new HttpOrigin(
      cdk.Fn.select(2, cdk.Fn.split("/", props.api.graphqlApi.graphqlUrl))
    );

    const filesOrigin = new S3Origin(props.chatbotFilesBucket);
    const websiteOrigin = new S3Origin(websiteBucket);

    const distribution = new cf.Distribution(this, "Distribution", {
      priceClass: cf.PriceClass.PRICE_CLASS_ALL,
      httpVersion: cf.HttpVersion.HTTP2_AND_3,
      defaultRootObject: "index.html",
      defaultBehavior: {
        origin: websiteOrigin,
        viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      additionalBehaviors: {
        "/graphql": {
          origin: appSyncOrigin,
          allowedMethods: cf.AllowedMethods.ALLOW_ALL,
          viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          responseHeadersPolicy,
          originRequestPolicy,
          cachePolicy: cf.CachePolicy.AMPLIFY,
        },
        "/graphql/*": {
          origin: appSyncOrigin,
          allowedMethods: cf.AllowedMethods.ALLOW_ALL,
          viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          responseHeadersPolicy,
          originRequestPolicy,
          cachePolicy: cf.CachePolicy.AMPLIFY,
        },
        "/chatbot/files/*": {
          origin: filesOrigin,
          allowedMethods: cf.AllowedMethods.ALLOW_ALL,
          viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          originRequestPolicy,
          cachePolicy: cf.CachePolicy.CACHING_DISABLED,
        },
      },
      errorResponses: [
        {
          httpStatus: 404,
          ttl: cdk.Duration.minutes(0),
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
        },
      ],
    });

    // Access Origin Control - workarounds

    function addOAC(
      originAccessControl: cf.CfnOriginAccessControl,
      distribution: cf.Distribution,
      index: number
    ) {
      const cfnDistribution = distribution.node
        .defaultChild as cf.CfnDistribution;
      cfnDistribution.addOverride(
        `Properties.DistributionConfig.Origins.${index}.S3OriginConfig.OriginAccessIdentity`,
        ""
      );
      cfnDistribution.addPropertyOverride(
        `DistributionConfig.Origins.${index}.OriginAccessControlId`,
        originAccessControl.getAtt("Id")
      );
    }

    addOAC(originAccessControl, distribution, 0);
    addOAC(originAccessControl, distribution, 2);

    const s3OriginNode = distribution.node
      .findAll()
      .filter((child) => child.node.id === "S3Origin");
    s3OriginNode.forEach((n) => n.node.tryRemoveChild("Resource"));

    function removeCanonicalUser(bucket: s3.IBucket, accountId: string) {
      const comS3PolicyOverride = bucket.node.findChild("Policy").node
        .defaultChild as s3.CfnBucketPolicy;

      comS3PolicyOverride.policyDocument.statements.forEach(
        (statement: any, idx: any) => {
          if (
            statement["_principal"] &&
            statement["_principal"].CanonicalUser
          ) {
            delete statement["_principal"].CanonicalUser;
          }
          comS3PolicyOverride.addOverride(
            `Properties.PolicyDocument.Statement.${idx}.Principal`,
            { Service: "cloudfront.amazonaws.com" }
          );
          comS3PolicyOverride.addOverride(
            `Properties.PolicyDocument.Statement.${idx}.Condition`,
            {
              StringEquals: {
                "AWS:SourceArn": `arn:aws:cloudfront::${accountId}:distribution/${distribution.distributionId}`,
              },
            }
          );
        }
      );
    }

    removeCanonicalUser(websiteBucket, cdk.Stack.of(this).account);
    removeCanonicalUser(props.chatbotFilesBucket, cdk.Stack.of(this).account);

    const exportsAsset = s3deploy.Source.jsonData("aws-exports.json", {
      aws_project_region: cdk.Aws.REGION,
      aws_cognito_region: cdk.Aws.REGION,
      aws_user_pools_id: props.userPoolId,
      aws_user_pools_web_client_id: props.userPoolClientId,
      aws_cognito_identity_pool_id: props.identityPool.identityPoolId,
      Auth: {
        region: cdk.Aws.REGION,
        userPoolId: props.userPoolId,
        userPoolWebClientId: props.userPoolClientId,
        identityPoolId: props.identityPool.identityPoolId,
      },
      aws_appsync_graphqlEndpoint: `https://${distribution.distributionDomainName}/graphql`,
      aws_appsync_region: cdk.Aws.REGION,
      aws_appsync_authenticationType: "AMAZON_COGNITO_USER_POOLS",
      aws_appsync_apiKey: props.api.graphqlApi?.apiKey,
      Storage: {
        AWSS3: {
          bucket: props.chatbotFilesBucket.bucketName,
          region: cdk.Aws.REGION,
        },
      },
      config: {
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
            `npm --cache /tmp/.npm run build`,
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
