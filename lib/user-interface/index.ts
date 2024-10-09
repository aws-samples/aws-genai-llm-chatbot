import * as cdk from "aws-cdk-lib";
import * as cf from "aws-cdk-lib/aws-cloudfront";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cognito from "aws-cdk-lib/aws-cognito";
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
import { PrivateWebsite } from "./private-website";
import { PublicWebsite } from "./public-website";
import { NagSuppressions } from "cdk-nag";

export interface UserInterfaceProps {
  readonly config: SystemConfig;
  readonly shared: Shared;
  readonly userPoolId: string;
  readonly userPoolClientId: string;
  readonly userPoolClient: cognito.UserPoolClient;
  readonly api: ChatBotApi;
  readonly chatbotFilesBucket: s3.Bucket;
  readonly crossEncodersEnabled: boolean;
  readonly sagemakerEmbeddingsEnabled: boolean;
}

export class UserInterface extends Construct {
  public readonly publishedDomain: string;
  public readonly cloudFrontDistribution?: cf.IDistribution;

  constructor(scope: Construct, id: string, props: UserInterfaceProps) {
    super(scope, id);

    const appPath = path.join(__dirname, "react-app");
    const buildPath = path.join(appPath, "dist");

    const uploadLogsBucket = new s3.Bucket(this, "WebsiteLogsBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy:
        props.config.retainOnDelete === true
          ? cdk.RemovalPolicy.RETAIN_ON_UPDATE_OR_DELETE
          : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: props.config.retainOnDelete !== true,
      enforceSSL: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
    });

    const websiteBucket = new s3.Bucket(this, "WebsiteBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      autoDeleteObjects: true,
      bucketName: props.config.privateWebsite ? props.config.domain : undefined,
      websiteIndexDocument: "index.html",
      websiteErrorDocument: "index.html",
      enforceSSL: true,
      serverAccessLogsBucket: uploadLogsBucket,
      // Cloudfront with OAI only supports S3 Managed Key (would need to migrate to OAC)
      // https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
    });

    // Deploy either Private (only accessible within VPC) or Public facing website
    let redirectSignIn: string;

    if (props.config.privateWebsite) {
      new PrivateWebsite(this, "PrivateWebsite", {
        ...props,
        websiteBucket: websiteBucket,
      });
      this.publishedDomain = props.config.domain ? props.config.domain : "";
      redirectSignIn = `https://${this.publishedDomain}/index.html`;
    } else {
      const publicWebsite = new PublicWebsite(this, "PublicWebsite", {
        ...props,
        websiteBucket: websiteBucket,
      });
      this.cloudFrontDistribution = publicWebsite.distribution;
      this.publishedDomain = props.config.domain
        ? props.config.domain
        : publicWebsite.distribution.distributionDomainName;
      redirectSignIn = `https://${this.publishedDomain}`;
    }

    const exportsAsset = s3deploy.Source.jsonData("aws-exports.json", {
      aws_project_region: cdk.Aws.REGION,
      aws_cognito_region: cdk.Aws.REGION,
      aws_user_pools_id: props.userPoolId,
      aws_user_pools_web_client_id: props.userPoolClientId,
      Auth: {
        region: cdk.Aws.REGION,
        userPoolId: props.userPoolId,
        userPoolWebClientId: props.userPoolClientId,
      },
      oauth: props.config.cognitoFederation?.enabled
        ? {
            domain: `${props.config.cognitoFederation.cognitoDomain}.auth.${cdk.Aws.REGION}.amazoncognito.com`,
            redirectSignIn: redirectSignIn,
            redirectSignOut: `https://${this.publishedDomain}`,
            Scopes: ["email", "openid"],
            responseType: "code",
          }
        : undefined,
      aws_appsync_graphqlEndpoint: props.api.graphqlApi.graphqlUrl,
      aws_appsync_region: cdk.Aws.REGION,
      aws_appsync_authenticationType: "AMAZON_COGNITO_USER_POOLS",
      config: {
        auth_federated_provider: props.config.cognitoFederation?.enabled
          ? {
              auto_redirect: props.config.cognitoFederation?.autoRedirect,
              custom: true,
              name: props.config.cognitoFederation?.customProviderName,
            }
          : undefined,
        rag_enabled: props.config.rag.enabled,
        cross_encoders_enabled: props.crossEncodersEnabled,
        sagemaker_embeddings_enabled: props.sagemakerEmbeddingsEnabled,
        default_embeddings_model: Utils.getDefaultEmbeddingsModel(props.config),
        default_cross_encoder_model: Utils.getDefaultCrossEncoderModel(
          props.config
        ),
        privateWebsite: props.config.privateWebsite ? true : false,
      },
    });

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

              // Safe because the command is not user provided
              execSync(`npm --silent --prefix "${appPath}" ci`, options); //NOSONAR Needed for the build process.
              execSync(`npm --silent --prefix "${appPath}" run build`, options); //NOSONAR
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
      distribution: props.config.privateWebsite
        ? undefined
        : this.cloudFrontDistribution,
    });

    /**
     * CDK NAG suppression
     */
    NagSuppressions.addResourceSuppressions(uploadLogsBucket, [
      {
        id: "AwsSolutions-S1",
        reason: "Bucket is the server access logs bucket for websiteBucket.",
      },
    ]);
  }
}
