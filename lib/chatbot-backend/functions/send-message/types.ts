import { ModelAdapterBase } from './adapters/base';
import { SessionManager } from './common/session-manager';

export interface LambdaGlobal {
  HttpResponseStream: {
    from: (stream: object, metadata: object) => LambdaStream;
  };
  streamifyResponse: (handler: (event: LambdaEvent, responseStream: object) => Promise<void>) => (event: LambdaEvent, context: object) => void;
}

export interface LambdaStream {
  write: (data: string) => void;
  end: () => void;
}

export interface LambdaEvent {
  headers: {
    idtoken?: string;
  };
  queryStringParameters?: { [key: string]: string };
  body: string;
}

export enum ChatMode {
  Standard = 'standard',
  Streaming = 'streaming',
}

export interface SessionMetadata {
  userId: string;
  sessionId: string;
  title: string;
  shouldStop: boolean;
  startTime: string;
}

export interface SessionHistoryItem {
  timestamp: number;
  sender: 'user' | 'system';
  content: string;
}

export interface StreamArgs {
  timestamp: number;
  sender: string;
  message: string;
}

export interface CompleteParams {
  prompt: string;
  history: SessionHistoryItem[];
  context: string[];
}

export interface CompleteArgs {
  prompt: string;
  history: SessionHistoryItem[];
  generatedText: string;
}

export interface ErrorArgs {
  error: string;
}

export interface GetPromptArgs {
  prompt: string;
  history: SessionHistoryItem[];
  context: string[];
  completion: {
    generatedText: string;
  };
}

export enum ContentType {
  APPLICATION_JSON = 'application/json',
}

export type ModelAdapterEntry = {
  pattern: RegExp;
  adapter: ModelAdapterBase;
};

export interface CreateModelAdatper {
  modelId: string;
  mode: string;
  sessionManager: SessionManager;
  stream: LambdaStream;
}

export interface CreateSessionManager {
  sessionId: string;
  userId: string;
  title: string;
}

export interface SemanticSearchParams {
  prompt: string;
}
