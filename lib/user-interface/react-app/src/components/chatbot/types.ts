import { Model, Workspace } from "../../API";
import { LoadingStatus, ModelInterface } from "../../common/types";
import { SelectProps } from "@cloudscape-design/components";

export interface ChatBotConfiguration {
  streaming: boolean;
  showMetadata: boolean;
  maxTokens: number;
  temperature: number;
  topP: number;
  files: ImageFile[] | null;
}

export interface ChatInputState {
  value: string;
  workspaces?: Workspace[];
  models?: Model[];
  selectedModel: SelectProps.Option | null;
  selectedModelMetadata: Model | null;
  selectedWorkspace: SelectProps.Option | null;
  modelsStatus: LoadingStatus;
  workspacesStatus: LoadingStatus;
}

export enum ChatBotMessageType {
  AI = "ai",
  Human = "human",
}

export enum ChatBotAction {
  Heartbeat = "heartbeat",
  Run = "run",
  FinalResponse = "final_response",
  LLMNewToken = "llm_new_token",
  Error = "error",
}

export enum ChatBotModelInterface {
  Langchain = "langchain",
  Idefics = "idefics",
}

export enum ChatBotMode {
  Chain = "chain",
}

export enum FileStorageProvider {
  S3 = "s3",
}

export interface ImageFile {
  provider: FileStorageProvider;
  key: string;
  url: string;
}

export interface ChatBotHeartbeatRequest {
  action: ChatBotAction.Heartbeat;
  modelInterface: ModelInterface;
  data: {
    sessionId: string;
  };
}

export interface ChatBotRunRequest {
  action: ChatBotAction.Run;
  modelInterface: ModelInterface;
  data: {
    modelName: string;
    provider: string;
    sessionId: string;
    files: ImageFile[] | null;
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

export interface RagDocument {
  page_content: string;
  metadata: {
    chunk_id: string;
    workspace_id: string;
    document_id: string;
    document_sub_id: string | null;
    document_type: string;
    document_sub_type: string | null;
    path: string;
    title: string | null;
    score: number;
  };
}

export interface ChatBotHistoryItem {
  type: ChatBotMessageType;
  content: string;
  metadata: Record<
    string,
    | string
    | boolean
    | number
    | null
    | undefined
    | ImageFile[]
    | string[]
    | string[][]
    | RagDocument[]
  >;
  tokens?: ChatBotToken[];
}

export interface ChatBotMessageResponse {
  action: ChatBotAction;
  data: {
    sessionId: string;
    token?: ChatBotToken;
    content?: string;
    metadata: Record<
      string,
      | string
      | boolean
      | number
      | null
      | undefined
      | ImageFile[]
      | string[]
      | string[][]
      | RagDocument[]
    >;
  };
}

export enum ChabotInputModality {
  Text = "TEXT",
  Image = "IMAGE",
}

export enum ChabotOutputModality {
  Text = "TEXT",
  Image = "IMAGE",
  Embedding = "EMBEDDING",
}

export interface FeedbackData {
  sessionId: string;
  key: number;
  feedback: number;
  prompt: string;
  completion: string;
  model: string;
}
