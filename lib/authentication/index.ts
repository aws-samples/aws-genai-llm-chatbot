import * as cdk from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import { Construct } from "constructs";

export class Authentication extends Construct {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const userPool = new cognito.UserPool(this, "UserPool", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      selfSignUpEnabled: false,
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

    this.userPool = userPool;
    this.userPoolClient = userPoolClient;

    new cdk.CfnOutput(this, "UserPoolId", {
      value: userPool.userPoolId,
    });

    new cdk.CfnOutput(this, 'UserPoolLink', {
      value: `https://${cdk.Stack.of(this).region}.console.aws.amazon.com/cognito/v2/idp/user-pools/${userPool.userPoolId}/users?region=${cdk.Stack.of(this).region}`,
    });

  }
}
