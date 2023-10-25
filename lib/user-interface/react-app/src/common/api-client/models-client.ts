import { ApiResult, ModelItem } from "../types";
import { ApiClientBase } from "./api-client-base";

export class ModelsClient extends ApiClientBase {
  async getModels(): Promise<ApiResult<ModelItem[]>> {
    try {
      const headers = await this.getHeaders();
      const result = await fetch(this.getApiUrl("/models"), {
        headers,
      });

      return result.json();
    } catch (error) {
      return this.error(error);
    }
  }
}
