import * as cdk from "aws-cdk-lib";
import { SystemConfig } from "../shared/types";
import * as cognito from "aws-cdk-lib/aws-cognito";
import { Construct } from "constructs";
import { NagSuppressions } from "cdk-nag";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as cr from "aws-cdk-lib/custom-resources";
import * as logs from "aws-cdk-lib/aws-logs";

export class Authentication extends Construct {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly cognitoDomain: cognito.UserPoolDomain;
  public readonly updateUserPoolClient: lambda.Function;
  public readonly customOidcProvider: cognito.UserPoolIdentityProviderOidc;
  public readonly customSamlProvider: cognito.UserPoolIdentityProviderSaml;

  constructor(scope: Construct, id: string, config: SystemConfig) {
    super(scope, id);

    const userPool = new cognito.UserPool(this, "UserPool", {
      removalPolicy:
        config.retainOnDelete === true
          ? cdk.RemovalPolicy.RETAIN_ON_UPDATE_OR_DELETE
          : cdk.RemovalPolicy.DESTROY,
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

    if (
      config.cognitoFederation?.enabled &&
      config.cognitoFederation?.cognitoDomain
    ) {
      const userPooldomain = userPool.addDomain("CognitoDomain", {
        cognitoDomain: {
          domainPrefix: config.cognitoFederation.cognitoDomain,
        },
      });
      this.cognitoDomain = userPooldomain;
    }

    if (config.cognitoFederation?.enabled) {
      // Create an IAM Role for the Lambda function
      const lambdaRoleUpdateClient = new iam.Role(
        this,
        "lambdaRoleUpdateClient",
        {
          assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
        }
      );

      // Attach the policy to the role that allows updating Cognito user pool client settings
      lambdaRoleUpdateClient.addToPolicy(
        new iam.PolicyStatement({
          actions: ["cognito-idp:UpdateUserPoolClient"],
          resources: [
            `arn:aws:cognito-idp:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:userpool/${userPool.userPoolId}`,
            `arn:aws:cognito-idp:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:userpool/${userPool.userPoolId}/client/*`,
          ],
        })
      );

      // Attach the policy to the role that allows logging to CloudWatch
      lambdaRoleUpdateClient.addToPolicy(
        new iam.PolicyStatement({
          actions: [
            "logs:CreateLogGroup",
            "logs:CreateLogStream",
            "logs:PutLogEvents",
          ],
          resources: ["*"],
        })
      );

      // Define a Lambda function to update the UserPoolClient
      const updateUserPoolClientLambda = new lambda.Function(
        this,
        "updateUserPoolClientLambda",
        {
          runtime: lambda.Runtime.NODEJS_20_X,
          handler: "index.handler",
          code: lambda.Code.fromAsset(
            "lib/authentication/lambda/updateUserPoolClient"
          ),
          description: "Updates the user pool client",
          role: lambdaRoleUpdateClient,
          logRetention: config.logRetention ?? logs.RetentionDays.ONE_WEEK,
          loggingFormat: lambda.LoggingFormat.JSON,
          environment: {
            USER_POOL_ID: userPool.userPoolId,
            USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
          },
        }
      );

      if (config.cognitoFederation?.customProviderType == "OIDC") {
        const customProvider = new cognito.UserPoolIdentityProviderOidc(
          this,
          "OIDCProvider",
          {
            clientId: config.cognitoFederation?.customOIDC?.OIDCClient || "",
            clientSecret: "secret",
            issuerUrl:
              config.cognitoFederation?.customOIDC?.OIDCIssuerURL || "",
            userPool: userPool,
            name: config.cognitoFederation?.customProviderName,
            scopes: ["openid", "email"],
          }
        );
        this.customOidcProvider = customProvider;

        // Unfortunately the above function does not support SecretValue for Client Secrets so updating with lambda
        // Create an IAM Role for the Lambda function
        const lambdaRoleUpdateOidcSecret = new iam.Role(
          this,
          "lambdaRoleUpdateOidcSecret",
          {
            assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
          }
        );

        // Attach the policy to the role that allows updating Cognito user pool client settings
        lambdaRoleUpdateOidcSecret.addToPolicy(
          new iam.PolicyStatement({
            actions: [
              "cognito-idp:UpdateIdentityProvider",
              "cognito-idp:DescribeIdentityProvider",
            ],
            resources: [
              `arn:aws:cognito-idp:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:userpool/${userPool.userPoolId}`,
            ],
          })
        );

        lambdaRoleUpdateOidcSecret.addToPolicy(
          new iam.PolicyStatement({
            actions: ["secretsmanager:GetSecretValue"],
            resources: [config.cognitoFederation?.customOIDC?.OIDCSecret || ""],
          })
        );

        // Attach the policy to the role that allows logging to CloudWatch
        lambdaRoleUpdateOidcSecret.addToPolicy(
          new iam.PolicyStatement({
            actions: [
              "logs:CreateLogGroup",
              "logs:CreateLogStream",
              "logs:PutLogEvents",
            ],
            resources: ["*"],
          })
        );

        const oidcSecretlambdaFunction = new lambda.Function(
          this,
          "OIDCSecretsHandler",
          {
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: "index.handler",
            code: lambda.Code.fromAsset(
              "lib/authentication/lambda/updateOidcSecret"
            ),
            description: "Updates OIDC secret",
            role: lambdaRoleUpdateOidcSecret,
            logRetention: config.logRetention ?? logs.RetentionDays.ONE_WEEK,
            loggingFormat: lambda.LoggingFormat.JSON,
            environment: {
              USER_POOL_ID: userPool.userPoolId,
              USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
            },
          }
        );

        new cr.AwsCustomResource(this, "UpdateSecret", {
          onUpdate: {
            service: "Lambda",
            action: "invoke",
            parameters: {
              FunctionName: oidcSecretlambdaFunction.functionName,
              Payload: JSON.stringify({
                UserPoolId: userPool.userPoolId,
                ProviderName: customProvider.providerName,
                SecretId:
                  config.cognitoFederation?.customOIDC?.OIDCSecret || "",
              }),
            },
            physicalResourceId: cr.PhysicalResourceId.of(Date.now().toString()),
          },
          policy: cr.AwsCustomResourcePolicy.fromStatements([
            new iam.PolicyStatement({
              actions: ["lambda:InvokeFunction"],
              resources: [oidcSecretlambdaFunction.functionArn],
            }),
          ]),
        });
      }
      if (config.cognitoFederation?.customProviderType == "SAML") {
        const customProvider = new cognito.UserPoolIdentityProviderSaml(
          this,
          "SAMLProvider",
          {
            metadata: cognito.UserPoolIdentityProviderSamlMetadata.url(
              config.cognitoFederation?.customSAML?.metadataDocumentUrl || ""
            ),
            userPool: userPool,
            name: config.cognitoFederation?.customProviderName,
          }
        );
        this.customSamlProvider = customProvider;
      }

      this.updateUserPoolClient = updateUserPoolClientLambda;
    }

    this.userPool = userPool;
    this.userPoolClient = userPoolClient;

    new cdk.CfnOutput(this, "UserPoolId", {
      value: userPool.userPoolId,
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
    if (config.cognitoFederation?.enabled) {
      NagSuppressions.addResourceSuppressionsByPath(
        cdk.Stack.of(this),
        [
          `/${
            cdk.Stack.of(this).stackName
          }/Authentication/lambdaRoleUpdateClient/DefaultPolicy/Resource`,
        ],
        [
          {
            id: "AwsSolutions-IAM5",
            reason: "IAM role implicitly created by CDK.",
          },
        ]
      );
      if (config.cognitoFederation?.customProviderType == "OIDC") {
        NagSuppressions.addResourceSuppressionsByPath(
          cdk.Stack.of(this),
          [
            `/${
              cdk.Stack.of(this).stackName
            }/Authentication/lambdaRoleUpdateOidcSecret/DefaultPolicy/Resource`,
          ],
          [
            {
              id: "AwsSolutions-IAM5",
              reason: "IAM role implicitly created by CDK.",
            },
          ]
        );
      }
    }
  }
}
