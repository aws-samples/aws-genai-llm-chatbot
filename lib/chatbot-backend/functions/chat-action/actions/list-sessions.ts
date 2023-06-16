import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';

const dynamodb_client = new DynamoDBClient({});

export async function listSessions({
  sessionTableName,
  startTimeIndexName,
  userId,
  request,
}: {
  sessionTableName: string;
  startTimeIndexName: string;
  userId: string;
  request: { limit: number; last?: string };
}) {
  const limit = Math.min(request.limit, 50);
  const lastStartTime = request.last || '';

  let getUserSessionCommand: QueryCommand;
  if (lastStartTime === '') {
    getUserSessionCommand = new QueryCommand({
      TableName: sessionTableName,
      IndexName: startTimeIndexName,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': { S: userId },
      },
      ProjectionExpression: 'sessionId, title, startTime',
      ScanIndexForward: false,
      Limit: limit,
    });
  } else {
    getUserSessionCommand = new QueryCommand({
      TableName: sessionTableName,
      IndexName: startTimeIndexName,
      KeyConditionExpression: 'userId = :userId and startTime < :startTime',
      ExpressionAttributeValues: {
        ':userId': { S: userId },
        ':startTime': { S: lastStartTime },
      },
      ProjectionExpression: 'sessionId, title, startTime',
      ScanIndexForward: false,
      Limit: limit,
    });
  }

  const response = await dynamodb_client.send(getUserSessionCommand);
  if (response.Items) {
    const sessions = response.Items.map((item) => {
      return {
        sessionId: item.sessionId.S ?? '',
        title: item.title.S ?? '',
        startTime: item.startTime.S ?? '',
      };
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        last: response.LastEvaluatedKey?.startTime.S,
        hasMore: sessions.length === limit,
        sessions,
      }),
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      last: null,
      hasMore: false,
      sessions: [],
    }),
  };
}
