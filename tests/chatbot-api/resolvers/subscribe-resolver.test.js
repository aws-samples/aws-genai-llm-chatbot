const toSubscriptionFilterMock = jest.fn();
const setSubscriptionFilterMock = jest.fn();
import * as subscribeResolver from "../../../lib/chatbot-api/functions/resolvers/subscribe-resolver";

jest.mock("@aws-appsync/utils", () => ({
  util: { transform: { toSubscriptionFilter: toSubscriptionFilterMock } },
  extensions: { setSubscriptionFilter: setSubscriptionFilterMock },
}));

test("generates the request", async () => {
  const response = subscribeResolver.request({});
  expect(response).toStrictEqual({
    payload: null,
  });
});

test("generates the response", async () => {
  const response = subscribeResolver.response({
    identity: { sub: "sub" },
    args: { sessionId: "sessionId" },
  });
  expect(toSubscriptionFilterMock).toHaveBeenCalledWith({
    and: [{ userId: { eq: "sub" } }, { sessionId: { eq: "sessionId" } }],
  });
  expect(setSubscriptionFilterMock).toHaveBeenCalled();
});
