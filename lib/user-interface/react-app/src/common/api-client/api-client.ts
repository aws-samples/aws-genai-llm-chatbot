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

  public get health() {
    if (!this._healthClient) {
      this._healthClient = new HealthClient(this._appConfig);
    }

    return this._healthClient;
  }

  public get ragEngines() {
    if (!this._ragEnginesClient) {
      this._ragEnginesClient = new RagEnginesClient(this._appConfig);
    }

    return this._ragEnginesClient;
  }

  public get embeddings() {
    if (!this._embeddingsClient) {
      this._embeddingsClient = new EmbeddingsClient(this._appConfig);
    }

    return this._embeddingsClient;
  }

  public get crossEncoders() {
    if (!this._crossEncodersClient) {
      this._crossEncodersClient = new CrossEncodersClient(this._appConfig);
    }

    return this._crossEncodersClient;
  }

  public get models() {
    if (!this._modelsClient) {
      this._modelsClient = new ModelsClient(this._appConfig);
    }

    return this._modelsClient;
  }

  public get workspaces() {
    if (!this._workspacesClient) {
      this._workspacesClient = new WorkspacesClient(this._appConfig);
    }

    return this._workspacesClient;
  }

  public get sessions() {
    if (!this._sessionsClient) {
      this._sessionsClient = new SessionsClient(this._appConfig);
    }

    return this._sessionsClient;
  }

  public get semanticSearch() {
    if (!this._semanticSearchClient) {
      this._semanticSearchClient = new SemanticSearchClient(this._appConfig);
    }

    return this._semanticSearchClient;
  }

  public get documents() {
    if (!this._documentsClient) {
      this._documentsClient = new DocumentsClient(this._appConfig);
    }

    return this._documentsClient;
  }

  public get kendra() {
    if (!this._kendraClient) {
      this._kendraClient = new KendraClient(this._appConfig);
    }

    return this._kendraClient;
  }

  constructor(protected _appConfig: AppConfig) {}
}
