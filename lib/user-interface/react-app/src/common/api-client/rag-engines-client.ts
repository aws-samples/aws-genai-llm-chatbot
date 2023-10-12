import { ApiResult, EngineItem } from "../types";
import { ApiClientBase } from "./api-client-base";

export class RagEnginesClient extends ApiClientBase {
  async getRagEngines(): Promise<ApiResult<EngineItem[]>> {
    try {
      const headers = await this.getHeaders();
      const result = await fetch(this.getApiUrl("/rag/engines"), {
        headers,
      });

      return result.json();
    } catch (error) {
      return this.error(error);
    }
  }
}
