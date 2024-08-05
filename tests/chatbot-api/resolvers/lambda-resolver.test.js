const errorMock = jest.fn();
import * as lambdaResolver from "../../../lib/chatbot-api/functions/resolvers/lambda-resolver";

jest.mock("@aws-appsync/utils", () => ({
  util: { error: errorMock },
}));

test("generates the request", async () => {
  const response = lambdaResolver.request({
    source: "source",
    args: [],
    identity: "identity",
    info: { fieldName: "fieldName" },
  });
  expect(response).toStrictEqual({
    operation: "Invoke",
    payload: {
      arguments: [],
      fieldName: "fieldName",
      identity: "identity",
      source: "source",
    },
  });
});

test("generates the response", async () => {
  const response = lambdaResolver.response({ result: "result" });
  expect(response).toBe("result");
  expect(errorMock).not.toHaveBeenCalled();
});

test("generates the error response", async () => {
  const response = lambdaResolver.response({ result: "result", error: {} });
  expect(response).toBe("result");
  expect(errorMock).toHaveBeenCalled();
});
