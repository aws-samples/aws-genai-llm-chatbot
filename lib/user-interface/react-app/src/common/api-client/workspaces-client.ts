import { ApiResult, WorkspaceItem } from "../types";
import { ApiClientBase } from "./api-client-base";

export class WorkspacesClient extends ApiClientBase {
  async getWorkspaces(): Promise<ApiResult<WorkspaceItem[]>> {
    try {
      const headers = await this.getHeaders();
      const result = await fetch(this.getApiUrl("/workspaces"), {
        headers,
      });

      return result.json();
    } catch (error) {
      return this.error(error);
    }
  }

  async getWorkspace(
    workspaceId: string
  ): Promise<ApiResult<WorkspaceItem | null>> {
    try {
      const headers = await this.getHeaders();
      const result = await fetch(this.getApiUrl(`/workspaces/${workspaceId}`), {
        headers,
      });

      return result.json();
    } catch (error) {
      return this.error(error);
    }
  }

  async createAuroraWorkspace(params: {
    name: string;
    embeddingsModelProvider: string;
    embeddingsModelName: string;
    crossEncoderModelProvider: string;
    crossEncoderModelName: string;
    languages: string[];
    metric: string;
    index: boolean;
    hybridSearch: boolean;
    chunking_strategy: string;
    chunkSize: number;
    chunkOverlap: number;
  }): Promise<ApiResult<{ id: string }>> {
    try {
      const headers = await this.getHeaders();
      const result = await fetch(this.getApiUrl("/workspaces"), {
        method: "PUT",
        headers,
        body: JSON.stringify({
          ...params,
          kind: "aurora",
        }),
      });

      return result.json();
    } catch (error) {
      return this.error(error);
    }
  }
}
