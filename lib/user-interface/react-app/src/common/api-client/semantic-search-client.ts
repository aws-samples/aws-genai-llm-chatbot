import { ApiResult, SemanticSearchResult } from "../types";
import { ApiClientBase } from "./api-client-base";

export class SemanticSearchClient extends ApiClientBase {
  async query(
    workspaceId: string,
    query: string
  ): Promise<ApiResult<SemanticSearchResult>> {
    try {
      const headers = await this.getHeaders();
      const result = await fetch(this.getApiUrl("/semantic-search"), {
        method: "POST",
        headers,
        body: JSON.stringify({ workspaceId, query }),
      });

      return result.json();
    } catch (error) {
      return this.error(error);
    }
  }
}
