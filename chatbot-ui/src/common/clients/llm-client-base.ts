import { ChatMode } from '../chat-context/chat-state';
import { AppConfig, ChatMessageSender } from '../types';
import { Auth } from 'aws-amplify';

export interface ListSessionsResult {
  last: string;
  hasMore: boolean;
  sessions: {
    sessionId: string;
    title: string;
    startTime: string;
  }[];
}

export interface GetSessionResult {
  sessionId: string;
  title: string;
  shouldStop: boolean;
  startTime: string;
  history: {
    timestamp: string;
    sender: ChatMessageSender;
    content: string;
  }[];
}

export abstract class LLMClientBase {
  private _idToken: string | null = null;

  constructor(protected _config: AppConfig) {}

  public abstract makeRequest(props: {
    modelId: string;
    mode: ChatMode;
    sessionId: string | null;
    prompt: string;
    onData: (sessionId: string, content: string) => void;
    onError: (sessionId: string, error: any) => void;
  }): Promise<void>;
  public abstract stopGeneration(sessionId: string | null): Promise<void>;
  public abstract listModels(): Promise<string[] | null>;
  public abstract listSessions(last: string): Promise<ListSessionsResult | null>;
  public abstract getSession(sessionId: string): Promise<GetSessionResult | null>;
  public abstract clearSessions(): Promise<void>;

  protected async getIdToken() {
    if (!this._idToken) {
      const session = await Auth.currentSession();
      this._idToken = session.getIdToken().getJwtToken();
    }

    return this._idToken;
  }
}
