import { JsonPrimitive, JsonValue } from "react-use-websocket/dist/lib/types";
import { LLMItem, LoadingStatus, WorkspaceItem } from "../../common/types";
import { SelectProps } from "@cloudscape-design/components";

export interface ChatBotConfiguration {
  streaming: boolean;
  showMetadata: boolean;
  maxTokens: number;
  temperature: number;
  topP: number;
}

export interface ChatInputState {
  value: string;
  workspaces?: WorkspaceItem[];
  models?: LLMItem[];
  selectedModel: SelectProps.Option | null;
  selectedWorkspace: SelectProps.Option | null;
  modelsStatus: LoadingStatus;
  workspacesStatus: LoadingStatus;
}

export enum ChatBotMessageType {
  AI = "ai",
  Human = "human",
}

export enum ChatBotAction {
  Run = "run",
  FinalResponse = "final_response",
  LLMNewToken = "llm_new_token",
  Error = "error",
}

export interface ChatBotRunRequest
  extends Record<string, JsonValue | JsonPrimitive> {
  action: ChatBotAction.Run;
  data: {
    modelName: string;
    provider: string;
    sessionId?: string;
    text: string;
    mode: string;
    workspaceId?: string;
    modelKwargs?: Record<string, string | boolean | number>;
  };
}

export interface ChatBotToken {
  sequenceNumber: number;
  runId?: string;
  value: string;
}

export interface ChatBotHistoryItem {
  type: ChatBotMessageType;
  content: string;
  metadata: Record<string, string | boolean | number>;
  tokens?: ChatBotToken[];
}

export interface ChatBotMessageResponse {
  action: ChatBotAction;
  data: {
    sessionId: string;
    token?: ChatBotToken;
    content?: string;
    metadata: Record<string, string | boolean | number>;
  };
}
