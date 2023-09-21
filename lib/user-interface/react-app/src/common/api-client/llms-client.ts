import { ApiResult, LLMItem } from "../types";
import { ApiClientBase } from "./api-client-base";

export class LLMsClient extends ApiClientBase {
  async getModels(): Promise<ApiResult<LLMItem[]>> {
    try {
      const headers = await this.getHeaders();
      const result = await fetch(this.getApiUrl("/llms"), {
        headers,
      });

      return result.json();
    } catch (error) {
      return this.error(error);
    }
  }
}
