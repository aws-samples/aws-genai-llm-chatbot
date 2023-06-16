import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';

const dynamodb_client = new DynamoDBClient({});

export async function stopGeneration({ sessionTableName, userId, request }: { sessionTableName: string; userId: string; request: { sessionId: string } }) {
  const sessionId = request.sessionId;

  if (!sessionId) {
    const error = 'Session ID is missing';
    throw new Error(error);
  }

  const updateSessionCommand = new UpdateItemCommand({
    TableName: sessionTableName,
    Key: {
      userId: { S: userId },
      sessionId: { S: sessionId },
    },
    UpdateExpression: 'SET shouldStop = :shouldStop',
    ExpressionAttributeValues: {
      ':shouldStop': { BOOL: true },
    },
    ConditionExpression: 'attribute_exists(userId) and attribute_exists(sessionId)',
  });

  await dynamodb_client.send(updateSessionCommand);

  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      stopped: true,
    }),
  };
}
