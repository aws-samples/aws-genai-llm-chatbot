import { promisify } from 'node:util';
import * as zlib from 'zlib';

import { DynamoDBClient, GetItemCommand, PutItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';

import { SessionHistoryItem, SessionMetadata } from '../types';

const dynamodb_client = new DynamoDBClient({});
const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export class SessionManager {
  public readonly sessionId: string;
  public session: Record<string, any>;

  constructor(
    protected _config: {
      sessionTableName: string;
      sessionId: string;
      userId: string;
      title: string;
    },
  ) {
    this.sessionId = _config.sessionId;
  }

  async init(): Promise<void> {
    this.session = await this.getOrCreateSession(this._config.title);
  }

  async getOrCreateSession(title: string): Promise<SessionMetadata> {
    const getSessionCommand = new GetItemCommand({
      TableName: this._config.sessionTableName,
      ConsistentRead: true,
      Key: {
        userId: { S: this._config.userId },
        sessionId: { S: this._config.sessionId },
      },
    });

    const response = await dynamodb_client.send(getSessionCommand);

    if (response.Item) {
      const item = response.Item;

      return {
        userId: item.userId.S ?? '',
        sessionId: item.sessionId.S ?? '',
        title: item.title.S ?? '',
        shouldStop: item.shouldStop.BOOL ?? false,
        startTime: item.startTime.S ?? '',
      };
    }

    const now = new Date();
    title = title.trim().substring(0, 100);

    const createSessionCommand = new PutItemCommand({
      TableName: this._config.sessionTableName,
      Item: {
        userId: { S: this._config.userId },
        sessionId: { S: this._config.sessionId },
        shouldStop: { BOOL: false },
        startTime: { S: now.toISOString() },
        title: { S: title },
      },
    });

    await dynamodb_client.send(createSessionCommand);

    return {
      userId: this._config.userId,
      sessionId: this._config.sessionId,
      title,
      shouldStop: false,
      startTime: now.toISOString(),
    };
  }

  async getShouldStop() {
    const getSessionCommand = new GetItemCommand({
      TableName: this._config.sessionTableName,
      Key: {
        userId: { S: this._config.userId },
        sessionId: { S: this._config.sessionId },
      },
      AttributesToGet: ['id', 'shouldStop'],
    });

    const response = await dynamodb_client.send(getSessionCommand);
    const item = response.Item;

    if (!item) {
      throw new Error(`Session ${this._config.sessionId} not found`);
    }

    const retValue = item.shouldStop.BOOL ?? true;

    return retValue;
  }

  async setShouldStop(shouldStop: boolean) {
    const updateSessionCommand = new UpdateItemCommand({
      TableName: this._config.sessionTableName,
      Key: {
        userId: { S: this._config.userId },
        sessionId: { S: this._config.sessionId },
      },
      UpdateExpression: 'SET shouldStop = :shouldStop',
      ExpressionAttributeValues: {
        ':shouldStop': { BOOL: shouldStop },
      },
      ConditionExpression: 'attribute_exists(userId) and attribute_exists(sessionId)',
    });

    await dynamodb_client.send(updateSessionCommand);
  }

  async getHistory(): Promise<SessionHistoryItem[]> {
    const getSessionHistoryCommand = new GetItemCommand({
      TableName: this._config.sessionTableName,
      Key: {
        userId: { S: this._config.userId },
        sessionId: { S: this._config.sessionId },
      },
    });

    const response = await dynamodb_client.send(getSessionHistoryCommand);
    const item = response.Item;

    if (item && item.history) {
      const compressed = item.history.B ?? '';
      const decompressed = await gunzip(compressed);

      const retValue = JSON.parse(decompressed.toString());
      return retValue;
    }

    return [];
  }

  async setHistory(history: SessionHistoryItem[], prompt: string, generatedText: string) {
    generatedText = generatedText ?? '';

    const now = new Date();
    const timestamp = now.getTime();

    const updatedHistory = [
      ...history,
      {
        timestamp,
        sender: 'user',
        content: prompt,
      },
      {
        timestamp,
        sender: 'system',
        content: generatedText,
      },
    ];

    const compressed = await gzip(JSON.stringify(updatedHistory));

    const setHistoryCommand = new UpdateItemCommand({
      TableName: this._config.sessionTableName,
      Key: {
        userId: { S: this._config.userId },
        sessionId: { S: this._config.sessionId },
      },
      UpdateExpression: 'SET history = :history',
      ExpressionAttributeValues: {
        ':history': { B: compressed },
      },
      ConditionExpression: 'attribute_exists(userId) and attribute_exists(sessionId)',
    });

    await dynamodb_client.send(setHistoryCommand);
  }
}
