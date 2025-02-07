import * as cdk from "aws-cdk-lib";
import * as appsync from "aws-cdk-lib/aws-appsync";
import * as cf from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import { Construct } from "constructs";
import { Shared } from "../shared";
import { SystemConfig } from "../shared/types";
import { ChatBotApi } from "../chatbot-api";
import { NagSuppressions } from "cdk-nag";

export interface PublicWebsiteProps {
  readonly config: SystemConfig;
  readonly shared: Shared;
  readonly userPoolId: string;
  readonly userPoolClientId: string;
  readonly api: ChatBotApi;
  readonly websiteBucket: s3.Bucket;
  readonly chatbotFilesBucket: s3.Bucket;
  readonly uploadBucket?: s3.Bucket;
}

export class PublicWebsite extends Construct {
  readonly distribution: cf.Distribution;

  constructor(scope: Construct, id: string, props: PublicWebsiteProps) {
    super(scope, id);

    /////////////////////////////////////
    ///// CLOUDFRONT IMPLEMENTATION /////
    /////////////////////////////////////

    const originAccessIdentity = new cf.OriginAccessIdentity(this, "S3OAI");
    props.websiteBucket.grantRead(originAccessIdentity);
    const cfGeoRestrictEnable = props.config.cfGeoRestrictEnable;
    const cfGeoRestrictList = props.config.cfGeoRestrictList;

    const distributionLogsBucket = new s3.Bucket(
      this,
      "DistributionLogsBucket",
      {
        objectOwnership: s3.ObjectOwnership.OBJECT_WRITER,
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        removalPolicy:
          props.config.retainOnDelete === true
            ? cdk.RemovalPolicy.RETAIN_ON_UPDATE_OR_DELETE
            : cdk.RemovalPolicy.DESTROY,
        autoDeleteObjects: props.config.retainOnDelete !== true,
        enforceSSL: true,
        encryption: props.shared.kmsKey
          ? s3.BucketEncryption.KMS
          : s3.BucketEncryption.S3_MANAGED,
        encryptionKey: props.shared.kmsKey,
        versioned: true,
      }
    );

    const fileBucketURLs = [
      `https://${props.chatbotFilesBucket.bucketName}.s3-accelerate.amazonaws.com`,
      `https://${props.chatbotFilesBucket.bucketName}.s3.amazonaws.com`,
    ];
    if (props.uploadBucket) {
      // Bucket used to upload documents to workspaces
      fileBucketURLs.push(
        `https://${props.uploadBucket.bucketName}.s3-accelerate.amazonaws.com`
      );
      fileBucketURLs.push(
        `https://${props.uploadBucket.bucketName}.s3.amazonaws.com`
      );
    }

    const websocketURL = (
      props.api.graphqlApi.node.findChild("Resource") as appsync.CfnGraphQLApi
    ).attrRealtimeUrl;
    const congnitoFederationDomain = props.config.cognitoFederation
      ? `${props.config.cognitoFederation.cognitoDomain}.auth.${cdk.Aws.REGION}.amazoncognito.com`
      : undefined;
    const responseHeadersPolicy = new cf.ResponseHeadersPolicy(
      this,
      "ResponseHeadersPolicy",
      {
        securityHeadersBehavior: {
          contentSecurityPolicy: {
            contentSecurityPolicy:
              "default-src 'self';" +
              `connect-src 'self' https://cognito-idp.${
                cdk.Stack.of(scope).region
              }.amazonaws.com/ ` +
              (congnitoFederationDomain
                ? `https://${congnitoFederationDomain} `
                : "") +
              `${websocketURL} ${fileBucketURLs.join(" ")} ${
                props.api.graphqlApi.graphqlUrl
              };` +
              "font-src 'self' data:; " + // Fonts are inline in the CSS files
              `img-src 'self' ${fileBucketURLs.join(" ")} blob:; ` +
              `media-src 'self' ${fileBucketURLs.join(" ")} blob:; ` +
              "style-src 'self' 'unsafe-inline';", // React uses inline style
            override: true,
          },
          contentTypeOptions: { override: true },
          frameOptions: {
            frameOption: cf.HeadersFrameOption.DENY,
            override: true,
          },
          referrerPolicy: {
            referrerPolicy: cf.HeadersReferrerPolicy.NO_REFERRER,
            override: true,
          },
          strictTransportSecurity: {
            accessControlMaxAge: cdk.Duration.seconds(47304000),
            includeSubdomains: true,
            override: true,
          },
          xssProtection: { protection: true, modeBlock: false, override: true },
        },
      }
    );

    const distribution = new cf.Distribution(this, "Distribution", {
      // CUSTOM DOMAIN FOR PUBLIC WEBSITE
      // REQUIRES:
      // 1. ACM Certificate ARN in us-east-1 and Domain of website to be input during 'npm run config':
      //    "privateWebsite" : false,
      //    "certificate" : "arn:aws:acm:us-east-1:1234567890:certificate/XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXX",
      //    "domain" : "sub.example.com"
      // 2. After the deployment, in your Route53 Hosted Zone, add an "A Record" that points to the Cloudfront Alias (https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/routing-to-cloudfront-distribution.html)
      ...(props.config.certificate &&
        props.config.domain && {
          certificate: acm.Certificate.fromCertificateArn(
            this,
            "CloudfrontAcm",
            props.config.certificate
          ),
          domainNames: [props.config.domain],
        }),

      priceClass: cf.PriceClass.PRICE_CLASS_ALL,
      httpVersion: cf.HttpVersion.HTTP2_AND_3,
      minimumProtocolVersion: cf.SecurityPolicyProtocol.TLS_V1_2_2021,
      enableLogging: true,
      logBucket: distributionLogsBucket,
      logIncludesCookies: false,
      defaultRootObject: "index.html",
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessIdentity(
          props.websiteBucket,
          {
            connectionTimeout: cdk.Duration.seconds(10),
            connectionAttempts: 3,
            originAccessIdentity: originAccessIdentity,
          }
        ),
        cachePolicy: cf.CachePolicy.CACHING_OPTIMIZED,
        viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        responseHeadersPolicy: responseHeadersPolicy,
      },
      geoRestriction: cfGeoRestrictEnable
        ? cf.GeoRestriction.allowlist(...cfGeoRestrictList)
        : undefined,
      errorResponses: [
        {
          httpStatus: 404,
          ttl: cdk.Duration.minutes(0),
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
        },
      ],
    });

    // Set the CFN resource id to prevent re-creating a new resource and change the URL
    // https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cloudfront-readme.html#migrating-from-the-original-cloudfrontwebdistribution-to-the-newer-distribution-construct
    const cfnDistribution = distribution.node
      .defaultChild as cf.CfnDistribution;
    cfnDistribution.overrideLogicalId(
      "UserInterfacePublicWebsiteDistributionCFDistribution17DC8E4E"
    );

    this.distribution = distribution;

    // ###################################################
    // Outputs
    // ###################################################
    new cdk.CfnOutput(this, "UserInterfaceDomainName", {
      value: `https://${distribution.distributionDomainName}`,
    });

    NagSuppressions.addResourceSuppressions(distributionLogsBucket, [
      {
        id: "AwsSolutions-S1",
        reason: "Bucket is the server access logs bucket for websiteBucket.",
      },
    ]);

    NagSuppressions.addResourceSuppressions(props.websiteBucket, [
      { id: "AwsSolutions-S5", reason: "OAI is configured for read." },
    ]);

    NagSuppressions.addResourceSuppressions(distribution, [
      { id: "AwsSolutions-CFR1", reason: "No geo restrictions" },
      {
        id: "AwsSolutions-CFR2",
        reason: "WAF not required due to configured Cognito auth.",
      },
      { id: "AwsSolutions-CFR4", reason: "TLS 1.2 is the default." },
    ]);
  }
}
