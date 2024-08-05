const {
  DescribeIdentityProviderCommand,
  CognitoIdentityProviderClient,
  UpdateIdentityProviderCommand,
} = require("@aws-sdk/client-cognito-identity-provider");
const {
  SecretsManagerClient,
  GetSecretValueCommand,
} = require("@aws-sdk/client-secrets-manager");

exports.handler = async (event) => {
  try {
    const { UserPoolId, ProviderName, SecretId } = event;
    console.log(
      `UserPoolId: ${UserPoolId} ProviderName: ${ProviderName} SecretId: ${SecretId}`
    );
    // Check if required properties are present
    if (!UserPoolId || !ProviderName || !SecretId) {
      throw new Error("Missing required properties in the event object.");
    }

    // Initialize AWS SDK clients
    const client = new SecretsManagerClient();
    const cognitoClient = new CognitoIdentityProviderClient();

    // Fetch the existing provider details to maintain other settings
    const existingProviderResponse = await cognitoClient.send(
      new DescribeIdentityProviderCommand({
        UserPoolId,
        ProviderName,
      })
    );

    const existingDetails =
      existingProviderResponse.IdentityProvider.ProviderDetails;

    // Fetch the client secret
    const secretValue = await client.send(
      new GetSecretValueCommand({ SecretId })
    );
    const clientSecret = secretValue.SecretString;

    // Update the OIDC provider with the client secret
    const response = await cognitoClient.send(
      new UpdateIdentityProviderCommand({
        UserPoolId,
        ProviderName,
        ProviderDetails: {
          ...existingDetails,
          client_secret: clientSecret,
        },
      })
    );

    return { status: "success", response: response };
  } catch (error) {
    console.error("Error updating OIDC provider:", error);
    throw error;
  }
};
