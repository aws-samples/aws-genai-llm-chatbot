const updateParamsMock = jest.fn();
import * as updateUserPoolClient from "../../../lib/authentication/lambda/updateUserPoolClient";

// Hide console logs in the tests
jest.spyOn(console, "error").mockImplementation(() => {});
jest.spyOn(console, "log").mockImplementation(() => {});
jest.mock("@aws-sdk/client-cognito-identity-provider", () => ({
  CognitoIdentityProviderClient: jest.fn().mockReturnValue({
    send: jest
      .fn()
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("Failure")),
  }),
  UpdateUserPoolClientCommand: updateParamsMock,
}));

const validEvent = {
  oAuthV: { callbackUrls: ["url"], logoutUrls: ["url"] },
  scopes: ["scope"],
  SecretId: "SecretId",
};

test("updates the user pool", async () => {
  process.env.USER_POOL_ID = "UserPoolId";
  process.env.USER_POOL_CLIENT_ID = "UserPoolClientId";
  const response = await updateUserPoolClient.handler(validEvent);

  expect(updateParamsMock).toHaveBeenCalledWith({
    UserPoolId: "UserPoolId",
    ClientId: "UserPoolClientId",
    CallbackURLs: validEvent.oAuthV.callbackUrls,
    LogoutURLs: validEvent.oAuthV.logoutUrls,
    AllowedOAuthFlowsUserPoolClient: true,
    AllowedOAuthFlows: ["code"],
    SupportedIdentityProviders: ["COGNITO"],
    AllowedOAuthScopes: validEvent.oAuthV.scopes,
  });
  expect(response.statusCode).toBe(200);
});

test("throws cognito failure", async () => {
  await expect(() => updateUserPoolClient.handler(validEvent)).rejects.toThrow(
    "Failed to update UserPoolClient"
  );
});
