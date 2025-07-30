import * as cdk from "aws-cdk-lib";
import { SystemConfig } from "../shared/types";
import * as cognito from "aws-cdk-lib/aws-cognito";
import { Construct } from "constructs";
import { NagSuppressions } from "cdk-nag";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as cr from "aws-cdk-lib/custom-resources";
import * as logs from "aws-cdk-lib/aws-logs";
import { getConstructId } from "../utils";

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
      featurePlan: cognito.FeaturePlan.PLUS,
      standardThreatProtectionMode:
        cognito.StandardThreatProtectionMode.FULL_FUNCTION,
      autoVerify: { email: true, phone: true },
      signInAliases: {
        email: true,
      },
    });

    new cognito.CfnUserPoolGroup(this, "AdminGroup", {
      userPoolId: userPool.userPoolId,
      groupName: "admin",
      description: "Administrators group",
    });

    new cognito.CfnUserPoolGroup(
      this,
      getConstructId("WorkspaceManagerGroup", config),
      {
        userPoolId: userPool.userPoolId,
        groupName: getConstructId("workspace_manager", config),
        description: "Workspace managers group",
      }
    );

    new cognito.CfnUserPoolGroup(this, "UserGroup", {
      userPoolId: userPool.userPoolId,
      groupName: getConstructId("user", config),
      description: "User group",
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
            scopes: ["openid", "email", "profile"],
            attributeRequestMethod: cognito.OidcAttributeRequestMethod.GET,
            attributeMapping: {
              custom: {
                "custom:chatbot_role": cognito.ProviderAttribute.other(
                  "custom:chatbot_role"
                ),
                email_verified:
                  cognito.ProviderAttribute.other("email_verified"),
                profile: cognito.ProviderAttribute.other("profile"),
              },
              email: cognito.ProviderAttribute.other("email"),
            },
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
            attributeMapping: {
              custom: {
                "custom:chatbot_role": cognito.ProviderAttribute.other(
                  "custom:chatbot_role"
                ),
                email_verified:
                  cognito.ProviderAttribute.other("email_verified"),
                profile: cognito.ProviderAttribute.other("profile"),
              },
              email: cognito.ProviderAttribute.other("email"),
            },
          }
        );
        this.customSamlProvider = customProvider;
      }

      this.updateUserPoolClient = updateUserPoolClientLambda;
    }

    if (config.cognitoFederation?.enabled) {
      const lambdaRoleAddUserToGroup = new iam.Role(
        this,
        "lambdaRoleAddUserToGroup",
        {
          assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
        }
      );

      lambdaRoleAddUserToGroup.addToPolicy(
        new iam.PolicyStatement({
          actions: [
            "logs:CreateLogGroup",
            "logs:CreateLogStream",
            "logs:PutLogEvents",
          ],
          resources: ["*"],
        })
      );
      const addFederatedUserToUserGroupLambda = new lambda.Function(
        this,
        "addFederatedUserToUserGroup",
        {
          runtime: lambda.Runtime.PYTHON_3_12,
          handler: "index.handler",
          code: lambda.Code.fromAsset(
            "lib/authentication/lambda/addFederatedUserToUserGroup"
          ),
          description:
            "Add federated user to Cognito user group defined in custom:chatbot_role attribute.",
          role: lambdaRoleAddUserToGroup,
          logRetention: config.logRetention ?? logs.RetentionDays.ONE_WEEK,
          loggingFormat: lambda.LoggingFormat.JSON,
          environment: {
            DEFAULT_USER_GROUP: getConstructId("user", config),
          },
        }
      );

      addFederatedUserToUserGroupLambda.addPermission(
        "CognitoPreSignUpTrigger",
        {
          principal: new iam.ServicePrincipal("cognito-idp.amazonaws.com"),
          sourceArn: userPool.userPoolArn,
        }
      );
      userPool.addTrigger(
        cognito.UserPoolOperation.PRE_SIGN_UP,
        addFederatedUserToUserGroupLambda
      );

      // Add a second trigger for POST_CONFIRMATION to handle group assignment
      addFederatedUserToUserGroupLambda.addPermission(
        "CognitoPostConfirmationTrigger",
        {
          principal: new iam.ServicePrincipal("cognito-idp.amazonaws.com"),
          sourceArn: userPool.userPoolArn,
        }
      );
      userPool.addTrigger(
        cognito.UserPoolOperation.POST_CONFIRMATION,
        addFederatedUserToUserGroupLambda
      );

      lambdaRoleAddUserToGroup.attachInlinePolicy(
        new iam.Policy(this, "AddUserToGroupPolicy", {
          statements: [
            new iam.PolicyStatement({
              actions: [
                "cognito-idp:AdminAddUserToGroup",
                "cognito-idp:AdminListGroupsForUser",
                "cognito-idp:AdminRemoveUserFromGroup",
              ],
              resources: [userPool.userPoolArn],
            }),
          ],
        })
      );
    }

    this.userPool = userPool;
    this.userPoolClient = userPoolClient;

    new cdk.CfnOutput(this, getConstructId("UserPoolId", config), {
      value: userPool.userPoolId,
      description: "User pool id for the chatbot application.",
      exportName: getConstructId("ChatbotUserPoolId", config),
    });

    new cdk.CfnOutput(this, getConstructId("UserPoolWebClientId", config), {
      value: userPoolClient.userPoolClientId,
      description: "App client id for the chatbot application.",
      exportName: getConstructId("ChatbotUserPoolClientId", config),
    });

    new cdk.CfnOutput(this, getConstructId("UserPoolLink", config), {
      value: `https://${
        cdk.Stack.of(this).region
      }.console.aws.amazon.com/cognito/v2/idp/user-pools/${
        userPool.userPoolId
      }/users?region=${cdk.Stack.of(this).region}`,
      description: "Link to user pool of the chatbot application.",
      exportName: getConstructId("ChatbotUserPoolLink", config),
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
      NagSuppressions.addResourceSuppressionsByPath(
        cdk.Stack.of(this),
        [
          `/${
            cdk.Stack.of(this).stackName
          }/Authentication/lambdaRoleAddUserToGroup/DefaultPolicy/Resource`,
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
