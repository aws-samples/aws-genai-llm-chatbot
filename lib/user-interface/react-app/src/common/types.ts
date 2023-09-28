import { SelectProps } from "@cloudscape-design/components";
import { CognitoHostedUIIdentityProvider } from "@aws-amplify/auth";
import { ChatBotHistoryItem } from "../components/chatbot/types";

export interface AppConfig {
  aws_project_region: string;
  config: {
    auth_federated_provider?:
      | { auto_redirect: boolean; custom: true; name: string }
      | {
          auto_redirect: boolean;
          custom: false;
          name: CognitoHostedUIIdentityProvider;
        };
    rag_enabled: boolean;
    api_endpoint: string;
    websocket_endpoint: string;
    default_embeddings_model: string;
    default_cross_encoder_model: string;
  };
}

export interface NavigationPanelState {
  collapsed?: boolean;
  collapsedSections?: Record<number, boolean>;
}

export type ApiResult<T> = ApiErrorResult | ApiOKResult<T>;
export abstract class ResultValue {
  static ok<T>(apiResult: ApiResult<T>): apiResult is ApiOKResult<T> {
    return (apiResult as ApiOKResult<T>).ok === true;
  }

  static error<T>(apiResult: ApiResult<T>): apiResult is ApiErrorResult {
    return (apiResult as ApiErrorResult).error === true;
  }
}

export interface ApiOKResult<T> {
  ok: true;
  data: T;
}

export interface ApiErrorResult {
  error: true;
  message?: string | string[];
}

export type LoadingStatus = "pending" | "loading" | "finished" | "error";
export type ModelProvider = "sagemaker" | "bedrock" | "openai";
export type RagDocumentType = "file" | "text" | "qna" | "website";

export interface WorkspaceItem {
  id: string;
  name: string;
  engine: string;
  status: string;
  languages: string[];
  embeddingsModelProvider: string;
  embeddingsModelName: string;
  embeddingsModelDimensions: number;
  crossEncoderModelProvider: string;
  crossEncoderModelName: string;
  metric: string;
  index: boolean;
  hybridSearch: boolean;
  chunkingStrategy: string;
  chunkSize: number;
  chunkOverlap: number;
  vectors: number;
  documents: number;
  kendraIndexId?: string;
  kendraIndexExternal?: boolean;
  sizeInBytes: number;
  createdAt: string;
}

export interface EngineItem {
  id: string;
  name: string;
  enabled: boolean;
}

export interface EmbeddingsModelItem {
  provider: ModelProvider;
  name: string;
  dimensions: number;
  default?: boolean;
}

export interface CrossEncoderModelItem {
  provider: ModelProvider;
  name: string;
  default?: boolean;
}

export interface LLMItem {
  provider: ModelProvider;
  name: string;
  streaming: boolean;
  type: string;
}

export interface SessionItem {
  id: string;
  title: string;
  startTime: string;
  history?: ChatBotHistoryItem[];
}

export interface DocumentItem {
  id: string;
  type: RagDocumentType;
  subType?: string;
  status: string;
  title?: string;
  path: string;
  sizeInBytes: number;
  vectors: number;
  subDocuments: number;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentResult {
  items: DocumentItem[];
  lastDocumentId?: string;
}

export interface AddDocumentResult {
  workspaceId: string;
  documentId: string;
}

export interface FileUploadItem {
  url: string;
  fields: Record<string, string>;
}

export interface SemanticSearchResultItem {
  sources: string[];
  chunkId: string;
  workspaceId: string;
  documentId: string;
  documentSubId: string;
  documentType: string;
  documentSubType: string;
  path: string;
  language: string;
  title: string;
  content: string;
  contentComplement: string;
  vectorSearchScore?: number;
  keywordSearchScore?: number;
  score?: number;
}

export interface SemanticSearchResult {
  engine: string;
  workspaceId: string;
  queryLanguage?: string;
  supportedLanguages?: string[];
  detectedLanguages?: {
    code: string;
    score: number;
  }[];
  vectorSearchMetric: string;
  items: SemanticSearchResultItem[];
  vectorSearchItems: SemanticSearchResultItem[];
  keywordSearchItems: SemanticSearchResultItem[];
}

export interface AuroraWorkspaceCreateInput {
  name: string;
  embeddingsModel: SelectProps.Option | null;
  crossEncoderModel: SelectProps.Option | null;
  languages: readonly SelectProps.Option[];
  metric: string;
  index: boolean;
  hybridSearch: boolean;
  chunkSize: number;
  chunkOverlap: number;
}

export interface OpenSearchWorkspaceCreateInput {
  name: string;
  embeddingsModel: SelectProps.Option | null;
  languages: readonly SelectProps.Option[];
  crossEncoderModel: SelectProps.Option | null;
  hybridSearch: boolean;
  chunkSize: number;
  chunkOverlap: number;
}

export interface KendraWorkspaceCreateInput {
  name: string;
  kendraIndex: SelectProps.Option | null;
}

export interface KendraIndexItem {
  id: string;
  name: string;
  external: boolean;
}
