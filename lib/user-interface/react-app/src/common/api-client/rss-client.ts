import { ApiResult, DocumentResult, DocumentItem } from "../types";
import { ApiClientBase } from "./api-client-base";

export class RssClient extends ApiClientBase {
  async getRssFeedSubscriptions(
    workspaceId: string
  ): Promise<ApiResult<DocumentResult>> {
    try {
      const headers = await this.getHeaders();
      const result = await fetch(this.getApiUrl(`/rss/${workspaceId}`), {
        headers,
      });

      return result.json();
    } catch (error) {
      return this.error(error);
    }
  }

  async getRssSubscriptionDetails(
    workspaceId: string,
    feedId: string
  ): Promise<ApiResult<DocumentItem | null>> {
    try {
      const headers = await this.getHeaders();
      const result = await fetch(
        this.getApiUrl(`/rss/${workspaceId}/${feedId}`),
        {
          headers,
        }
      );

      return result.json();
    } catch (error) {
      return this.error(error);
    }
  }

  async getRssSubscriptionPosts(
    workspaceId: string,
    feedId: string
  ): Promise<ApiResult<DocumentResult>> {
    try {
      const headers = await this.getHeaders();
      const result = await fetch(
        this.getApiUrl(`/rss/${workspaceId}/${feedId}/posts`),
        {
          headers,
        }
      );

      return result.json();
    } catch (error) {
      return this.error(error);
    }
  }

  async addRssFeedSubscription(
    workspaceId: string,
    rssFeedUrl: string,
    rssFeedTitle: string
  ): Promise<ApiResult<DocumentItem>> {
    try {
      const headers = await this.getHeaders();
      const results = await fetch(this.getApiUrl(`/rss/${workspaceId}`), {
        headers: headers,
        method: "POST",
        body: JSON.stringify({ rssFeedUrl, rssFeedTitle }),
      });
      return results.json();
    } catch (error) {
      return this.error(error);
    }
  }

  async disableRssSubscription(
    workspaceId: string,
    feedId: string
  ): Promise<ApiResult<DocumentItem>> {
    try {
      const headers = await this.getHeaders();
      const results = await fetch(
        this.getApiUrl(`/rss/${workspaceId}/${feedId}/disable`),
        {
          headers: headers,
        }
      );
      return results.json();
    } catch (error) {
      return this.error(error);
    }
  }

  async enableRssSubscription(
    workspaceId: string,
    feedId: string
  ): Promise<ApiResult<DocumentItem>> {
    try {
      const headers = await this.getHeaders();
      const results = await fetch(
        this.getApiUrl(`/rss/${workspaceId}/${feedId}/enable`),
        {
          headers: headers,
        }
      );
      return results.json();
    } catch (error) {
      return this.error(error);
    }
  }
}
