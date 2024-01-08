import * as cdk from "aws-cdk-lib";
import * as cf from "aws-cdk-lib/aws-cloudfront";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct, IConstruct } from "constructs";

interface AccessOriginControlProps {
  bucket: s3.IBucket;
  distribution: cf.IDistribution;
}

export class AccessOriginControl extends Construct {
  public readonly accessOriginControl: cf.CfnOriginAccessControl;

  constructor(scope: Construct, id: string, props: AccessOriginControlProps) {
    super(scope, id);

    const originAccessControl = new cf.CfnOriginAccessControl(
      this,
      "OriginAccessControl",
      {
        originAccessControlConfig: {
          signingBehavior: "always",
          signingProtocol: "sigv4",
          originAccessControlOriginType: "s3",
          name: `${cdk.Stack.of(this).stackId}${id}`,
        },
      }
    );

    // Access Origin Control - workarounds

    function addOAC(
      originAccessControl: cf.CfnOriginAccessControl,
      distribution: cf.IDistribution,
      index: number
    ) {
      const origins = distribution.node.findChild("Origins").node.children;

      origins.forEach((origin: IConstruct) => {
        const s3OriginConfig = origin.node.tryFindChild("S3OriginConfig");
        if (s3OriginConfig) {
          console.log(
            origin.node.findChild("Fn::GetAtt").node.children[0].node
          );
          console.log(props.bucket.node.id);
        }
      });

      //   props.distribution.addOverride(
      //     `Properties.DistributionConfig.Origins.${index}.S3OriginConfig.OriginAccessIdentity`,
      //     ""
      //   );
      //   istribution.addPropertyOverride(
      //     `DistributionConfig.Origins.${index}.OriginAccessControlId`,
      //     originAccessControl.getAtt("Id")
      //   );
    }

    addOAC(originAccessControl, props.distribution, 0);
    addOAC(originAccessControl, props.distribution, 2);

    const s3OriginNode = props.distribution.node
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
                "AWS:SourceArn": `arn:aws:cloudfront::${accountId}:distribution/${props.distribution.distributionId}`,
              },
            }
          );
        }
      );
    }
    removeCanonicalUser(props.bucket, cdk.Stack.of(this).account);
    this.accessOriginControl = originAccessControl;
  }
}
