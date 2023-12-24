import { ApiResult } from "../types";
import { ApiClientBase } from "./api-client-base";

export class UserFeedbackClient extends ApiClientBase {

  async addUserFeedback(params: {
    sessionId: string;
    key: number;
    feedback: string;
  }): Promise<ApiResult<{ id: string }>> {
    try {
      const headers = await this.getHeaders();
      const result = await fetch(this.getApiUrl("/user-feedback"), {
        method: "PUT",
        headers,
        body: JSON.stringify({
          ...params
        }),
      });

      if(!result.ok) {
        console.log("Result: ", result);
      }
      return result.json();
    } catch (error) {
      return this.error(error);
    }
  }
}
