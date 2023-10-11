import { ApiResult, KendraIndexItem } from "../types";
import { ApiClientBase } from "./api-client-base";

export class KendraClient extends ApiClientBase {
  async getKendraIndexes(): Promise<ApiResult<KendraIndexItem[]>> {
    try {
      const headers = await this.getHeaders();
      const result = await fetch(
        this.getApiUrl("/rag/engines/kendra/indexes"),
        {
          headers,
        }
      );

      return result.json();
    } catch (error) {
      return this.error(error);
    }
  }

  async startKendraDataSync(workspaceId: string): Promise<ApiResult<void>> {
    try {
      const headers = await this.getHeaders();
      const result = await fetch(
        this.getApiUrl("/rag/engines/kendra/data-sync"),
        {
          headers,
          method: "POST",
          body: JSON.stringify({ workspaceId }),
        }
      );

      return result.json();
    } catch (error) {
      return this.error(error);
    }
  }

  async kendraIsSyncing(workspaceId: string): Promise<ApiResult<boolean>> {
    try {
      const headers = await this.getHeaders();
      const result = await fetch(
        this.getApiUrl(`/rag/engines/kendra/data-sync/${workspaceId}`),
        {
          headers,
          method: "GET",
        }
      );

      return result.json();
    } catch (error) {
      return this.error(error);
    }
  }
}
