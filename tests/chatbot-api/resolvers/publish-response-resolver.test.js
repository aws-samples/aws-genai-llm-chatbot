import * as publishResponseResolver from "../../../lib/chatbot-api/functions/resolvers/publish-response-resolver";

test("generates the request", async () => {
  const response = publishResponseResolver.request({
    arguments: { data: "data", userId: "userId", sessionId: "sessionId" },
  });
  expect(response).toStrictEqual({
    payload: {
      data: "data",
      userId: "userId",
      sessionId: "sessionId",
    },
  });
});

test("generates the response", async () => {
  const response = publishResponseResolver.response({ result: "result" });
  expect(response).toBe("result");
});
