import { ApiResult } from "../types";
import { ApiClientBase } from "./api-client-base";

export class HealthClient extends ApiClientBase {
  async health(): Promise<ApiResult<null>> {
    try {
      const headers = await this.getHeaders();
      const result = await fetch(this.getApiUrl("/health"), {
        headers,
      });

      return result.json();
    } catch (error) {
      return this.error(error);
    }
  }
}
