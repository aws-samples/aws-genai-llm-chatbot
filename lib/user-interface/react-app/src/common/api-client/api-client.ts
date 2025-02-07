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
import { BedrockKBClient } from "./kb-client";
import { RolesClient } from "./roles-client";
import { ApplicationsClient } from "./applications-client";

export class ApiClient {
  private _healthClient?: HealthClient;
  private _ragEnginesClient?: RagEnginesClient;
  private _embeddingsClient?: EmbeddingsClient;
  private _crossEncodersClient?: CrossEncodersClient;
  private _modelsClient?: ModelsClient;
  private _workspacesClient?: WorkspacesClient;
  private _sessionsClient?: SessionsClient;
  private _semanticSearchClient?: SemanticSearchClient;
  private _documentsClient?: DocumentsClient;
  private _kendraClient?: KendraClient;
  private _userFeedbackClient?: UserFeedbackClient;
  private _bedrockKBClient?: BedrockKBClient;
  private _rolesClient?: RolesClient;
  private _applicationsClient?: ApplicationsClient;

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

  public get bedrockKB() {
    if (!this._bedrockKBClient) {
      this._bedrockKBClient = new BedrockKBClient();
    }

    return this._bedrockKBClient;
  }

  public get userFeedback() {
    if (!this._userFeedbackClient) {
      this._userFeedbackClient = new UserFeedbackClient();
    }

    return this._userFeedbackClient;
  }

  public get roles() {
    if (!this._rolesClient) {
      this._rolesClient = new RolesClient();
    }

    return this._rolesClient;
  }

  public get applications() {
    if (!this._applicationsClient) {
      this._applicationsClient = new ApplicationsClient();
    }

    return this._applicationsClient;
  }

  constructor(protected _appConfig: AppConfig) {}
}
