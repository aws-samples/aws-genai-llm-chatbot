const toSubscriptionFilterMock = jest.fn();
const matchesMock = jest.fn();
const errorMock = jest.fn();
const setSubscriptionFilterMock = jest.fn();
import * as subscribeResolver from "../../../lib/chatbot-api/functions/resolvers/subscribe-resolver";

jest.mock("@aws-appsync/utils", () => ({
  util: {
    transform: { toSubscriptionFilter: toSubscriptionFilterMock },
    error: errorMock,
    matches: matchesMock,
  },
  extensions: { setSubscriptionFilter: setSubscriptionFilterMock },
}));

test("generates the request", async () => {
  const response = subscribeResolver.request({});
  expect(response).toStrictEqual({
    payload: null,
  });
});

test("generates the response", async () => {
  setSubscriptionFilterMock.mockClear();
  errorMock.mockClear();
  matchesMock.mockClear();
  matchesMock.mockReturnValueOnce(true);
  const response = subscribeResolver.response({
    identity: { sub: "sub" },
    args: { sessionId: "sessionId" },
  });
  expect(toSubscriptionFilterMock).toHaveBeenCalledWith({
    and: [{ userId: { eq: "sub" } }, { sessionId: { eq: "sessionId" } }],
  });
  expect(errorMock).not.toHaveBeenCalled();
  expect(setSubscriptionFilterMock).toHaveBeenCalled();
  expect(matchesMock).toHaveBeenCalledWith("[a-z0-9-]{10,50}", "sessionId");
});

test("generates an error", async () => {
  setSubscriptionFilterMock.mockClear();
  matchesMock.mockClear();
  errorMock.mockClear();
  matchesMock.mockReturnValueOnce(false);
  const response = subscribeResolver.response({
    identity: { sub: "sub" },
    args: { sessionId: "<>" },
  });
  expect(errorMock).toHaveBeenCalled();
  expect(setSubscriptionFilterMock).not.toHaveBeenCalled();
  expect(matchesMock).toHaveBeenCalledWith("[a-z0-9-]{10,50}", "<>");
});
