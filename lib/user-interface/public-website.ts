import * as apigwv2 from "@aws-cdk/aws-apigatewayv2-alpha";
import * as cognitoIdentityPool from "@aws-cdk/aws-cognito-identitypool-alpha";
import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as cf from "aws-cdk-lib/aws-cloudfront";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as route53 from "aws-cdk-lib/aws-route53";
import { IpTarget } from "aws-cdk-lib/aws-elasticloadbalancingv2-targets";
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
import { NagSuppressions } from "cdk-nag";


export interface PublicWebsiteProps {
  readonly config: SystemConfig;
  readonly shared: Shared;
  readonly userPoolId: string;
  readonly userPoolClientId: string;
  readonly identityPool: cognitoIdentityPool.IdentityPool;
  readonly api: ChatBotApi;
  readonly chatbotFilesBucket: s3.Bucket;
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
    props.chatbotFilesBucket.grantRead(originAccessIdentity);
    
    
    const distributionLogsBucket = new s3.Bucket(	
      this,	
      "DistributionLogsBucket",	
      {	
        objectOwnership: s3.ObjectOwnership.OBJECT_WRITER,	
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,	
        removalPolicy: cdk.RemovalPolicy.DESTROY,	
        autoDeleteObjects: true,	
        enforceSSL: true,	
      }	
    );

    const distribution = new cf.CloudFrontWebDistribution(	
      this,	
      "Distribution",	
      {	
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

    this.distribution = distribution;

    // ###################################################
    // Outputs
    // ###################################################
    new cdk.CfnOutput(this, "UserInterfaceDomainName", {
      value: `https://${distribution.distributionDomainName}`,
    });
    
    NagSuppressions.addResourceSuppressions(
      distributionLogsBucket,
      [
        {
          id: "AwsSolutions-S1",
          reason: "Bucket is the server access logs bucket for websiteBucket.",
        },
      ]
    );
    
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
