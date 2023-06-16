import { ChatMessage } from '../types';

export interface ChatState {
  models: string[];
  modelId: string | null;
  mode: ChatMode;
  sessions: {
    items: ChatStateSession[];
    hasMore: boolean;
  };
  currentSession: {
    generationState: GenerationState;
    sessionId: string | null;
    messages: ChatMessage[];
  };
}

export enum GenerationState {
  IDLE = 'idle',
  GENERATING = 'generating',
}

export enum ChatMode {
  STANDARD = 'standard',
  STREAMING = 'streaming',
}

export interface ChatStateSession {
  sessionId: string;
  title: string;
  startTime: string;
}
