import * as updateOidcSecret from "../../../lib/authentication/lambda/updateOidcSecret";

// Hide console logs in the tests
jest.spyOn(console, "error").mockImplementation(() => {});
jest.spyOn(console, "log").mockImplementation(() => {});

jest.mock("@aws-sdk/client-cognito-identity-provider", () => ({
  CognitoIdentityProviderClient: jest.fn().mockReturnValue({
    send: jest
      .fn()
      .mockResolvedValueOnce({
        IdentityProvider: { ProviderDetails: {} },
      })
      .mockResolvedValueOnce({
        IdentityProvider: "Set",
      })
      .mockRejectedValueOnce(new Error("Failure")),
  }),
  DescribeIdentityProviderCommand: jest.fn(),
  UpdateIdentityProviderCommand: jest.fn(),
}));

jest.mock("@aws-sdk/client-secrets-manager", () => ({
  SecretsManagerClient: jest.fn().mockReturnValueOnce({
    send: jest.fn().mockResolvedValueOnce({
      secretValue: { SecretString: "secret" },
    }),
  }),
  GetSecretValueCommand: jest.fn(),
}));

const validEvent = {
  UserPoolId: "UserPoolId",
  ProviderName: "ProviderName",
  SecretId: "SecretId",
};

test("updates the secret", async () => {
  const response = await updateOidcSecret.handler(validEvent);

  expect(response.status).toBe("success");
  expect(response.response.IdentityProvider).toBe("Set");
});

test("throws due to invalid event", async () => {
  await expect(() => updateOidcSecret.handler({})).rejects.toThrow(
    "Missing required properties in the event object."
  );
});

test("throws cognito failure", async () => {
  await expect(() => updateOidcSecret.handler(validEvent)).rejects.toThrow(
    "Failure"
  );
});
