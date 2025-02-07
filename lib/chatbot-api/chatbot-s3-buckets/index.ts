import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as kms from "aws-cdk-lib/aws-kms";
import { NagSuppressions } from "cdk-nag";

export interface ChatBotS3BucketsProps {
  readonly retainOnDelete?: boolean;
  readonly kmsKey?: kms.Key;
}

export class ChatBotS3Buckets extends Construct {
  public readonly filesBucket: s3.Bucket;
  public readonly userFeedbackBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: ChatBotS3BucketsProps) {
    super(scope, id);

    const logsBucket = new s3.Bucket(this, "LogsBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy:
        props.retainOnDelete === true
          ? cdk.RemovalPolicy.RETAIN_ON_UPDATE_OR_DELETE
          : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: props.retainOnDelete !== true,
      enforceSSL: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
    });

    const filesBucket = new s3.Bucket(this, "FilesBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy:
        props.retainOnDelete === true
          ? cdk.RemovalPolicy.RETAIN_ON_UPDATE_OR_DELETE
          : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: props.retainOnDelete !== true,
      transferAcceleration: true,
      enforceSSL: true,
      serverAccessLogsBucket: logsBucket,
      encryption: props.kmsKey
        ? s3.BucketEncryption.KMS
        : s3.BucketEncryption.S3_MANAGED,
      encryptionKey: props.kmsKey,
      versioned: true,
      // Delete user files that have been mark for delete after
      lifecycleRules: [
        {
          id: "Delete mark for delete and incomplete uploads",
          enabled: true,
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(1),
          noncurrentVersionExpiration: cdk.Duration.days(30),
          expiredObjectDeleteMarker: true,
        },
      ],
      cors: [
        {
          allowedHeaders: ["*"],
          allowedMethods: [
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
            s3.HttpMethods.GET,
            s3.HttpMethods.HEAD,
          ],
          allowedOrigins: ["*"],
          exposedHeaders: ["ETag"],
          maxAge: 3000,
        },
      ],
    });

    const userFeedbackBucket = new s3.Bucket(this, "UserFeedbackBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy:
        props.retainOnDelete === true
          ? cdk.RemovalPolicy.RETAIN_ON_UPDATE_OR_DELETE
          : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: props.retainOnDelete !== true,
      enforceSSL: true,
      serverAccessLogsBucket: logsBucket,
      encryption: props.kmsKey
        ? s3.BucketEncryption.KMS
        : s3.BucketEncryption.S3_MANAGED,
      encryptionKey: props.kmsKey,
      versioned: true,
    });

    this.filesBucket = filesBucket;
    this.userFeedbackBucket = userFeedbackBucket;

    /**
     * CDK NAG suppression
     */
    NagSuppressions.addResourceSuppressions(logsBucket, [
      {
        id: "AwsSolutions-S1",
        reason: "Logging bucket does not require it's own access logs.",
      },
    ]);
  }
}
