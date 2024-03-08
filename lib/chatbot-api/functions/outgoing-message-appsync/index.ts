import {
  BatchProcessor,
  EventType,
  processPartialResponse,
} from "@aws-lambda-powertools/batch";
import { Logger } from "@aws-lambda-powertools/logger";
import type {
  SQSEvent,
  SQSRecord,
  Context,
  SQSBatchResponse,
} from "aws-lambda";
import { graphQlQuery } from "./graphql";

const processor = new BatchProcessor(EventType.SQS);
const logger = new Logger();

const recordHandler = async (record: SQSRecord): Promise<void> => {
  const payload = record.body;
  if (payload) {
    const item = JSON.parse(payload);

    const req = JSON.parse(item.Message);
    logger.debug("Processed message", req);
    /***
     * Payload format
     * 
      payload: str = record.body
      message: dict = json.loads(payload)
      detail: dict = json.loads(message["Message"])
      logger.info(detail)
      user_id = detail["userId"]
    */

    const query = /* GraphQL */ `
        mutation Mutation {
          publishResponse (data: ${JSON.stringify(item.Message)}, sessionId: "${
            req.data.sessionId
          }", userId: "${req.userId}") {
            data
            sessionId
            userId
          }
        }
    `;
    //logger.info(query);
    const resp = await graphQlQuery(query);
    //logger.info(resp);
  }
};

export const handler = async (
  event: SQSEvent,
  context: Context
): Promise<SQSBatchResponse> => {
  logger.debug("Event", { event });
  event.Records = event.Records.sort((a, b) => {
    try {
      const x: number = JSON.parse(a.body).Message.data?.token?.sequenceNumber;
      const y: number = JSON.parse(b.body).Message.data?.token?.sequenceNumber;
      return x - y;
    } catch {
      return 0;
    }
  });
  return processPartialResponse(event, recordHandler, processor, {
    context,
  });
};
