import * as cdk from "aws-cdk-lib";
import * as cf from "aws-cdk-lib/aws-cloudfront";
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
  readonly crossEncodersEnabled: boolean;
  readonly sagemakerEmbeddingsEnabled: boolean;
  readonly websiteBucket: s3.Bucket;
}

export class PublicWebsite extends Construct {
  readonly distribution: cf.CloudFrontWebDistribution;

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

    const distribution = new cf.CloudFrontWebDistribution(
      this,
      "Distribution",
      {
        // CUSTOM DOMAIN FOR PUBLIC WEBSITE
        // REQUIRES:
        // 1. ACM Certificate ARN in us-east-1 and Domain of website to be input during 'npm run config':
        //    "privateWebsite" : false,
        //    "certificate" : "arn:aws:acm:us-east-1:1234567890:certificate/XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXX",
        //    "domain" : "sub.example.com"
        // 2. After the deployment, in your Route53 Hosted Zone, add an "A Record" that points to the Cloudfront Alias (https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/routing-to-cloudfront-distribution.html)
        ...(props.config.certificate &&
          props.config.domain && {
            viewerCertificate: cf.ViewerCertificate.fromAcmCertificate(
              acm.Certificate.fromCertificateArn(
                this,
                "CloudfrontAcm",
                props.config.certificate
              ),
              {
                aliases: [props.config.domain],
                securityPolicy: cf.SecurityPolicyProtocol.TLS_V1_2_2021,
              }
            ),
          }),
        viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        priceClass: cf.PriceClass.PRICE_CLASS_ALL,
        httpVersion: cf.HttpVersion.HTTP2_AND_3,
        loggingConfig: {
          bucket: distributionLogsBucket,
        },
        originConfigs: [
          {
            behaviors: [{ isDefaultBehavior: true }],
            s3OriginSource: {
              s3BucketSource: props.websiteBucket,
              originAccessIdentity,
            },
          },
        ],
        geoRestriction: cfGeoRestrictEnable
          ? cf.GeoRestriction.allowlist(...cfGeoRestrictList)
          : undefined,
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
