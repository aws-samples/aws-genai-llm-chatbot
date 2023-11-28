import {
  AddDocumentResult,
  ApiResult,
  DocumentResult,
  DocumentSubscriptionToggleResult,
  FileUploadItem,
  RagDocumentType,
} from "../types";
import { ApiClientBase } from "./api-client-base";

export class DocumentsClient extends ApiClientBase {
  async presignedFileUploadPost(
    workspaceId: string,
    fileName: string
  ): Promise<ApiResult<FileUploadItem>> {
    try {
      const headers = await this.getHeaders();
      const result = await fetch(
        this.getApiUrl(`/workspaces/${workspaceId}/documents/file-upload`),
        {
          method: "POST",
          headers,
          body: JSON.stringify({ fileName }),
        }
      );

      return result.json();
    } catch (error) {
      return this.error(error);
    }
  }

  async getDocuments(
    workspaceId: string,
    documentType: RagDocumentType,
    lastDocumentId?: string
  ): Promise<ApiResult<DocumentResult>> {
    try {
      const headers = await this.getHeaders();
      const result = await fetch(
        lastDocumentId
          ? this.getApiUrl(
              `/workspaces/${workspaceId}/documents/${documentType}?lastDocumentId=${lastDocumentId}`
            )
          : this.getApiUrl(
              `/workspaces/${workspaceId}/documents/${documentType}`
            ),
        {
          headers,
        }
      );

      return result.json();
    } catch (error) {
      return this.error(error);
    }
  }

  async getDocumentDetails(
    workspaceId: string,
    documentId: string
  ): Promise<ApiResult<DocumentResult>> {
    try {
      const headers = await this.getHeaders();
      const result = await fetch(
        this.getApiUrl(
          `/workspaces/${workspaceId}/documents/${documentId}/detail`
        ),
        {
          headers,
        }
      );
      return result.json();
    } catch (error) {
      return this.error(error);
    }
  }

  async addTextDocument(
    workspaceId: string,
    title: string,
    content: string
  ): Promise<ApiResult<AddDocumentResult>> {
    try {
      const headers = await this.getHeaders();
      const result = await fetch(
        this.getApiUrl(`/workspaces/${workspaceId}/documents/text`),
        {
          method: "POST",
          headers,
          body: JSON.stringify({ title, content }),
        }
      );

      return result.json();
    } catch (error) {
      return this.error(error);
    }
  }

  async addQnADocument(
    workspaceId: string,
    question: string,
    answer: string
  ): Promise<ApiResult<AddDocumentResult>> {
    try {
      const headers = await this.getHeaders();
      const result = await fetch(
        this.getApiUrl(`/workspaces/${workspaceId}/documents/qna`),
        {
          method: "POST",
          headers,
          body: JSON.stringify({ question, answer }),
        }
      );

      return result.json();
    } catch (error) {
      return this.error(error);
    }
  }

  async addWebsiteDocument(
    workspaceId: string,
    sitemap: boolean,
    address: string,
    followLinks: boolean,
    limit: number
  ): Promise<ApiResult<AddDocumentResult>> {
    try {
      const headers = await this.getHeaders();
      const result = await fetch(
        this.getApiUrl(`/workspaces/${workspaceId}/documents/website`),
        {
          method: "POST",
          headers,
          body: JSON.stringify({ sitemap, address, followLinks, limit }),
        }
      );

      return result.json();
    } catch (error) {
      return this.error(error);
    }
  }

  async addRssFeedSubscription(
    workspaceId: string,
    address: string,
    title: string,
    limit: number,
    followLinks: boolean
  ): Promise<ApiResult<AddDocumentResult>> {
    try {
      const headers = await this.getHeaders();
      const results = await fetch(
        this.getApiUrl(`/workspaces/${workspaceId}/documents/rssfeed`),
        {
          headers: headers,
          method: "POST",
          body: JSON.stringify({ address, title, limit, followLinks }),
        }
      );
      return results.json();
    } catch (error) {
      return this.error(error);
    }
  }

  async getRssSubscriptionPosts(
    workspaceId: string,
    feedId: string,
    lastDocumentId?: string
  ): Promise<ApiResult<DocumentResult>> {
    try {
      const headers = await this.getHeaders();
      const result = await fetch(
        lastDocumentId
          ? this.getApiUrl(
              `/workspaces/${workspaceId}/documents/${feedId}/posts?lastDocumentId=${lastDocumentId}`
            )
          : this.getApiUrl(
              `/workspaces/${workspaceId}/documents/${feedId}/posts`
            ),
        {
          headers,
        }
      );

      return result.json();
    } catch (error) {
      return this.error(error);
    }
  }

  async disableRssSubscription(
    workspaceId: string,
    feedId: string
  ): Promise<ApiResult<DocumentSubscriptionToggleResult>> {
    try {
      const headers = await this.getHeaders();
      const results = await fetch(
        this.getApiUrl(
          `/workspaces/${workspaceId}/documents/${feedId}/disable`
        ),
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
  ): Promise<ApiResult<DocumentSubscriptionToggleResult>> {
    try {
      const headers = await this.getHeaders();
      const results = await fetch(
        this.getApiUrl(`/workspaces/${workspaceId}/documents/${feedId}/enable`),
        {
          headers: headers,
        }
      );
      return results.json();
    } catch (error) {
      return this.error(error);
    }
  }

  async updateRssSubscriptionCrawler(
    workspaceId: string,
    feedId: string,
    followLinks: boolean,
    limit: number
  ): Promise<ApiResult<string>> {
    try {
      const headers = await this.getHeaders();
      const result = await fetch(
        this.getApiUrl(`/workspaces/${workspaceId}/documents/${feedId}`),
        {
          method: "PATCH",
          headers: headers,
          body: JSON.stringify({ followLinks, limit, documentType: "rssfeed" }),
        }
      );
      return result.json();
    } catch (error) {
      return this.error(error);
    }
  }
}
