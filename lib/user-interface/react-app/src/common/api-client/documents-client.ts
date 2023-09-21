import {
  AddDocumentResult,
  ApiResult,
  DocumentResult,
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
    address: string
  ): Promise<ApiResult<AddDocumentResult>> {
    try {
      const headers = await this.getHeaders();
      const result = await fetch(
        this.getApiUrl(`/workspaces/${workspaceId}/documents/website`),
        {
          method: "POST",
          headers,
          body: JSON.stringify({ sitemap, address }),
        }
      );

      return result.json();
    } catch (error) {
      return this.error(error);
    }
  }
}
