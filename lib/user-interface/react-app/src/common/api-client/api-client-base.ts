import { Auth } from "aws-amplify";
import { ApiErrorResult, AppConfig } from "../types";

export abstract class ApiClientBase {
  constructor(protected _appConfig: AppConfig) {}

  protected getApiUrl(url: string) {
    let apiEndpoint = this._appConfig.config.api_endpoint;
    if (apiEndpoint.endsWith("/")) {
      apiEndpoint = apiEndpoint.slice(0, -1);
    }

    return `${apiEndpoint}/v1${url}`;
  }

  protected async getHeaders() {
    return {
      Authorization: `Bearer ${await this.getIdToken()}`,
    };
  }

  protected async getIdToken() {
    const session = await Auth.currentSession();
    return session.getIdToken().getJwtToken();
  }

  protected error(error: unknown): ApiErrorResult {
    console.error(error);
    if (error instanceof Error) {
      return { error: true, message: error.message };
    } else {
      return { error: true, message: error!.toString() };
    }
  }
}
