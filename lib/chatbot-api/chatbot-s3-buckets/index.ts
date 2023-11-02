import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import { NagSuppressions } from "cdk-nag";

export class ChatBotS3Buckets extends Construct {
  public readonly filesBucket: s3.Bucket;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const logsBucket = new s3.Bucket(this, "LogsBucket");

    const filesBucket = new s3.Bucket(this, "FilesBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      transferAcceleration: true,
      serverAccessLogsBucket:  logsBucket,
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

    this.filesBucket = filesBucket;

    NagSuppressions.addResourceSuppressions(logsBucket,
      [
        {id: "AwsSolutions-S1", reason: "Logging bucket does not require it's own access logs."},
        {id: "AwsSolutions-S10", reason: "Logging bucket does not require SSL."}
      ]
    );
    NagSuppressions.addResourceSuppressions(filesBucket,
      [
        {id: "AwsSolutions-S10", reason: "Bucket only used for internal requests."}
      ]
    );
  }
}
