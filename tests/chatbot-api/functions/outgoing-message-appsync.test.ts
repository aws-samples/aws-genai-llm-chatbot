process.env.GRAPHQL_ENDPOINT = "https://invalid-url.amazon.com";
const fecthMock = jest
  .fn()
  .mockResolvedValue({ json: jest.fn().mockReturnValue("return") });
import { Context, SQSEvent, SQSRecord } from "aws-lambda";
import { handler } from "../../../lib/chatbot-api/functions/outgoing-message-appsync";

jest.spyOn(global, "fetch").mockImplementation(fecthMock);

jest.mock("@aws-sdk/signature-v4", () => ({
  SignatureV4: jest.fn().mockReturnValue({
    sign: jest.fn((request) => request),
  }),
}));

beforeAll(() => {
  process.env.COGNITO_USER_POOL_ID = "mock-user-pool-id";
});

afterAll(() => {
  delete process.env.COGNITO_USER_POOL_ID;
});

const validEvent: SQSEvent = {
  Records: [
    {
      body: JSON.stringify({
        Message: JSON.stringify({
          userId: "userId1",
          data: { sessionId: "sessionId1", token: { sequenceNumber: 1 } },
        }),
      }),
    } as SQSRecord,
    {
      body: JSON.stringify({
        Message: JSON.stringify({
          userId: "userId9999",
          data: { sessionId: "sessionId9999", token: { sequenceNumber: 9999 } },
        }),
      }),
    } as SQSRecord,
  ],
} as SQSEvent;

const validContext: Context = {} as Context;

test("queries the graphql endpoint", async () => {
  const response = await handler(validEvent, validContext);
  const firstCallParams = fecthMock.mock.calls[0][0];
  const secondCallParams = fecthMock.mock.calls[1][0];
  expect(firstCallParams.method).toBe("POST");
  expect(firstCallParams.headers.get("Content-Type")).toBe("application/json");

  const firstGraphqlQuery = await firstCallParams.text();
  const secondGraphqlQuery = await secondCallParams.text();

  // Verify the graphql query contains the inputs
  expect(secondGraphqlQuery).toContain("mutation Mutation {");
  expect(firstGraphqlQuery).toContain("userId1");
  expect(secondGraphqlQuery).toContain("userId9999");
  expect(secondGraphqlQuery).toContain("sessionId9999");
  expect(response.batchItemFailures).toBeDefined();
  expect(response.batchItemFailures.length).toBe(0);
});

test("failing request", async () => {
  fecthMock.mockReset();
  fecthMock.mockRejectedValue(new Error("Failure"));
  await expect(() => handler(validEvent, validContext)).rejects.toThrow(
    "All records failed processing. See individual errors below."
  );
});
