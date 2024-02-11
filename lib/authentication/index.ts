import * as cognitoIdentityPool from "@aws-cdk/aws-cognito-identitypool-alpha";
import * as cdk from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import { Construct } from "constructs";
import { NagSuppressions } from "cdk-nag";

export class Authentication extends Construct {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly identityPool: cognitoIdentityPool.IdentityPool;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const userPool = new cognito.UserPool(this, "UserPool", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      selfSignUpEnabled: false,
      mfa: cognito.Mfa.OPTIONAL,
      advancedSecurityMode: cognito.AdvancedSecurityMode.ENFORCED,
      autoVerify: { email: true, phone: true },
      signInAliases: {
        email: true,
      },
    });

    const userPoolClient = userPool.addClient("UserPoolClient", {
      generateSecret: false,
      authFlows: {
        adminUserPassword: true,
        userPassword: true,
        userSrp: true,
      },
    });

    const identityPool = new cognitoIdentityPool.IdentityPool(
      this,
      "IdentityPool",
      {
        authenticationProviders: {
          userPools: [
            new cognitoIdentityPool.UserPoolAuthenticationProvider({
              userPool,
              userPoolClient,
            }),
          ],
        },
      }
    );

    this.userPool = userPool;
    this.userPoolClient = userPoolClient;
    this.identityPool = identityPool;

    new cdk.CfnOutput(this, "UserPoolId", {
      value: userPool.userPoolId,
    });

    new cdk.CfnOutput(this, "IdentityPoolId", {
      value: identityPool.identityPoolId,
    });

    new cdk.CfnOutput(this, "UserPoolWebClientId", {
      value: userPoolClient.userPoolClientId,
    });

    new cdk.CfnOutput(this, "UserPoolLink", {
      value: `https://${
        cdk.Stack.of(this).region
      }.console.aws.amazon.com/cognito/v2/idp/user-pools/${
        userPool.userPoolId
      }/users?region=${cdk.Stack.of(this).region}`,
    });

    /**
     * CDK NAG suppression
     */
    NagSuppressions.addResourceSuppressions(userPool, [
      {
        id: "AwsSolutions-COG1",
        reason:
          "Default password policy requires min length of 8, digits, lowercase characters, symbols and uppercase characters: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cognito.PasswordPolicy.html",
      },
      { id: "AwsSolutions-COG2", reason: "MFA not required for user usage." },
    ]);
  }
}
