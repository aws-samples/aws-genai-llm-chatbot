import { AppConfig } from "../types";
import { CrossEncodersClient } from "./cross-encoders-client";
import { EmbeddingsClient } from "./embeddings-client";
import { RagEnginesClient } from "./rag-engines-client";
import { HealthClient } from "./health-client";
import { ModelsClient } from "./models-client";
import { WorkspacesClient } from "./workspaces-client";
import { SessionsClient } from "./sessions-client";
import { SemanticSearchClient } from "./semantic-search-client";
import { DocumentsClient } from "./documents-client";
import { KendraClient } from "./kendra-client";
import { UserFeedbackClient } from "./user-feedback-client";

export class ApiClient {
  private _healthClient: HealthClient | undefined;
  private _ragEnginesClient: RagEnginesClient | undefined;
  private _embeddingsClient: EmbeddingsClient | undefined;
  private _crossEncodersClient: CrossEncodersClient | undefined;
  private _modelsClient: ModelsClient | undefined;
  private _workspacesClient: WorkspacesClient | undefined;
  private _sessionsClient: SessionsClient | undefined;
  private _semanticSearchClient: SemanticSearchClient | undefined;
  private _documentsClient: DocumentsClient | undefined;
  private _kendraClient: KendraClient | undefined;
  private _userFeedbackClient: UserFeedbackClient | undefined;

  public get health() {
    if (!this._healthClient) {
      this._healthClient = new HealthClient();
    }

    return this._healthClient;
  }

  public get ragEngines() {
    if (!this._ragEnginesClient) {
      this._ragEnginesClient = new RagEnginesClient();
    }

    return this._ragEnginesClient;
  }

  public get embeddings() {
    if (!this._embeddingsClient) {
      this._embeddingsClient = new EmbeddingsClient();
    }

    return this._embeddingsClient;
  }

  public get crossEncoders() {
    if (!this._crossEncodersClient) {
      this._crossEncodersClient = new CrossEncodersClient();
    }

    return this._crossEncodersClient;
  }

  public get models() {
    if (!this._modelsClient) {
      this._modelsClient = new ModelsClient();
    }

    return this._modelsClient;
  }

  public get workspaces() {
    if (!this._workspacesClient) {
      this._workspacesClient = new WorkspacesClient();
    }

    return this._workspacesClient;
  }

  public get sessions() {
    if (!this._sessionsClient) {
      this._sessionsClient = new SessionsClient();
    }

    return this._sessionsClient;
  }

  public get semanticSearch() {
    if (!this._semanticSearchClient) {
      this._semanticSearchClient = new SemanticSearchClient();
    }

    return this._semanticSearchClient;
  }

  public get documents() {
    if (!this._documentsClient) {
      this._documentsClient = new DocumentsClient();
    }

    return this._documentsClient;
  }

  public get kendra() {
    if (!this._kendraClient) {
      this._kendraClient = new KendraClient();
    }

    return this._kendraClient;
  }

  public get userFeedback() {
    if (!this._userFeedbackClient) {
      this._userFeedbackClient = new UserFeedbackClient();
    }

    return this._userFeedbackClient;
  }

  constructor(protected _appConfig: AppConfig) {}
}
