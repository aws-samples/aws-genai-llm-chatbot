import { promisify } from 'node:util';
import * as zlib from 'zlib';

import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';

const dynamodb_client = new DynamoDBClient({});
const gunzip = promisify(zlib.gunzip);

export async function getSession({ sessionTableName, userId, request }: { sessionTableName: string; userId: string; request: { sessionId: string } }) {
  const sessionId = request.sessionId;

  if (!sessionId) {
    const error = 'Session ID is missing';
    throw new Error(error);
  }

  const getSessionHistoryCommand = new GetItemCommand({
    TableName: sessionTableName,
    Key: {
      userId: { S: userId },
      sessionId: { S: sessionId },
    },
  });

  const response = await dynamodb_client.send(getSessionHistoryCommand);
  const item = response.Item;

  if (item && item.history) {
    const compressed = item.history.B ?? '';
    const decompressed = await gunzip(compressed);

    const history = JSON.parse(decompressed.toString());

    return {
      statusCode: 200,
      body: JSON.stringify({
        sessionId: item.sessionId.S ?? '',
        title: item.title.S ?? '',
        shouldStop: item.shouldStop.BOOL ?? false,
        startTime: item.startTime.S ?? '',
        history,
      }),
    };
  }

  return {
    statusCode: 404,
    body: JSON.stringify({
      error: true,
      message: `Session ${sessionId} not found`,
    }),
  };
}
