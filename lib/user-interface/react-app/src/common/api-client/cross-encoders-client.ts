import { ApiResult, CrossEncoderModelItem } from "../types";
import { ApiClientBase } from "./api-client-base";

export class CrossEncodersClient extends ApiClientBase {
  async getModels(): Promise<ApiResult<CrossEncoderModelItem[]>> {
    try {
      const headers = await this.getHeaders();
      const result = await fetch(this.getApiUrl("/cross-encoders/models"), {
        headers,
      });

      return result.json();
    } catch (error) {
      return this.error(error);
    }
  }

  async getRanking(
    provider: string,
    model: string,
    input: string,
    passages: string[]
  ): Promise<ApiResult<number[]>> {
    try {
      const headers = await this.getHeaders();
      const result = await fetch(this.getApiUrl("/cross-encoders"), {
        method: "POST",
        headers,
        body: JSON.stringify({ provider, model, input, passages }),
      });

      return result.json();
    } catch (error) {
      return this.error(error);
    }
  }
}
