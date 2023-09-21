import { ApiResult, SessionItem } from "../types";
import { ApiClientBase } from "./api-client-base";

export class SessionsClient extends ApiClientBase {
  async getSessions(): Promise<ApiResult<SessionItem[]>> {
    try {
      const headers = await this.getHeaders();
      const result = await fetch(this.getApiUrl("/sessions"), {
        headers,
      });

      return result.json();
    } catch (error) {
      return this.error(error);
    }
  }

  async getSession(sessionId: string): Promise<ApiResult<SessionItem | null>> {
    try {
      const headers = await this.getHeaders();
      const result = await fetch(this.getApiUrl(`/sessions/${sessionId}`), {
        headers,
      });

      return result.json();
    } catch (error) {
      return this.error(error);
    }
  }

  async deleteSession(
    sessionId: string
  ): Promise<ApiResult<{ deleted: boolean }>> {
    try {
      const headers = await this.getHeaders();
      const result = await fetch(this.getApiUrl(`/sessions/${sessionId}`), {
        method: "DELETE",
        headers,
      });

      return result.json();
    } catch (error) {
      return this.error(error);
    }
  }

  async deleteSessions(): Promise<
    ApiResult<{
      id: string;
      deleted: boolean;
    }>
  > {
    try {
      const headers = await this.getHeaders();
      const result = await fetch(this.getApiUrl("/sessions"), {
        method: "DELETE",
        headers,
      });

      return result.json();
    } catch (error) {
      return this.error(error);
    }
  }
}
