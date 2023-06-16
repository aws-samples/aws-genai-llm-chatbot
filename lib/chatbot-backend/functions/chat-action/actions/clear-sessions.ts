import { DynamoDBClient, QueryCommand, BatchWriteItemCommand } from '@aws-sdk/client-dynamodb';

const dynamodb_client = new DynamoDBClient({});

export async function clearSessions({ sessionTableName, userId }: { sessionTableName: string; userId: string }) {
  const getUserSessionCommand = new QueryCommand({
    TableName: sessionTableName,
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: {
      ':userId': { S: userId },
    },
    ProjectionExpression: 'sessionId',
    ScanIndexForward: false,
  });

  const response = await dynamodb_client.send(getUserSessionCommand);
  if (response.Items) {
    const deleteRequests = response.Items.map((item) => ({
      DeleteRequest: {
        Key: {
          userId: { S: userId },
          sessionId: { S: item.sessionId.S || '' },
        },
      },
    }));

    const command = new BatchWriteItemCommand({
      RequestItems: {
        [sessionTableName]: deleteRequests,
      },
    });

    const deleteResponse = await dynamodb_client.send(command);
    console.log(deleteResponse);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      ok: true,
    }),
  };
}
