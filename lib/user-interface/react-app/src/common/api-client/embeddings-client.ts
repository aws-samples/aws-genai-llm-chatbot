import { ApiResult, EmbeddingsModelItem } from "../types";
import { ApiClientBase } from "./api-client-base";

export class EmbeddingsClient extends ApiClientBase {
  async getModels(): Promise<ApiResult<EmbeddingsModelItem[]>> {
    try {
      const headers = await this.getHeaders();
      const result = await fetch(this.getApiUrl("/embeddings/models"), {
        headers,
      });

      return result.json();
    } catch (error) {
      return this.error(error);
    }
  }

  async getEmbeddings(
    provider: string,
    model: string,
    input: string[]
  ): Promise<ApiResult<number[][]>> {
    try {
      const headers = await this.getHeaders();
      const result = await fetch(this.getApiUrl("/embeddings"), {
        method: "POST",
        headers,
        body: JSON.stringify({ provider, model, input }),
      });

      return result.json();
    } catch (error) {
      return this.error(error);
    }
  }
}
