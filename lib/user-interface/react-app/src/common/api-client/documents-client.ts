import { API } from "aws-amplify";
import { GraphQLQuery, GraphQLResult } from "@aws-amplify/api";
import {
  getDocument,
  listDocuments,
  getUploadFileURL,
  getRSSPosts,
} from "../../graphql/queries";
import {
  addQnADocument,
  addRssFeed,
  updateRssFeed,
  addTextDocument,
  addWebsite,
  setDocumentSubscriptionStatus,
  deleteDocument,
} from "../../graphql/mutations";
import {
  AddQnADocumentMutation,
  AddRssFeedMutation,
  AddTextDocumentMutation,
  AddWebsiteMutation,
  SetDocumentSubscriptionStatusMutation,
  GetDocumentQuery,
  ListDocumentsQuery,
  GetRSSPostsQuery,
  GetUploadFileURLQuery,
  UpdateRssFeedMutation,
  DeleteDocumentMutation,
} from "../../API";
import { RagDocumentType } from "../types";

export class DocumentsClient {
  async presignedFileUploadPost(
    workspaceId: string,
    fileName: string
  ): Promise<GraphQLResult<GraphQLQuery<GetUploadFileURLQuery>>> {
    const result = API.graphql<GraphQLQuery<GetUploadFileURLQuery>>({
      query: getUploadFileURL,
      variables: {
        input: {
          workspaceId,
          fileName,
        },
      },
    });
    return result;
  }

  async getDocuments(
    workspaceId: string,
    documentType: RagDocumentType,
    lastDocumentId?: string
  ): Promise<GraphQLResult<GraphQLQuery<ListDocumentsQuery>>> {
    const result = API.graphql<GraphQLQuery<ListDocumentsQuery>>({
      query: listDocuments,
      variables: {
        input: {
          workspaceId,
          documentType,
          lastDocumentId,
        },
      },
    });
    return result;
  }

  async getDocumentDetails(
    workspaceId: string,
    documentId: string
  ): Promise<GraphQLResult<GraphQLQuery<GetDocumentQuery>>> {
    const result = API.graphql<GraphQLQuery<GetDocumentQuery>>({
      query: getDocument,
      variables: {
        input: {
          workspaceId,
          documentId,
        },
      },
    });
    return result;
  }

  async addTextDocument(
    workspaceId: string,
    title: string,
    content: string
  ): Promise<GraphQLResult<GraphQLQuery<AddTextDocumentMutation>>> {
    const result = API.graphql<GraphQLQuery<AddTextDocumentMutation>>({
      query: addTextDocument,
      variables: {
        input: {
          workspaceId,
          title,
          content,
        },
      },
    });
    return result;
  }

  async addQnADocument(
    workspaceId: string,
    question: string,
    answer: string
  ): Promise<GraphQLResult<GraphQLQuery<AddQnADocumentMutation>>> {
    const result = API.graphql<GraphQLQuery<AddQnADocumentMutation>>({
      query: addQnADocument,
      variables: {
        input: {
          workspaceId,
          question,
          answer,
        },
      },
    });
    return result;
  }

  async addWebsiteDocument(
    workspaceId: string,
    sitemap: boolean,
    address: string,
    followLinks: boolean,
    limit: number,
    contentTypes: string[]
  ): Promise<GraphQLResult<GraphQLQuery<AddWebsiteMutation>>> {
    const result = API.graphql<GraphQLQuery<AddWebsiteMutation>>({
      query: addWebsite,
      variables: {
        input: {
          workspaceId,
          sitemap,
          address,
          followLinks,
          limit,
          contentTypes,
        },
      },
    });
    return result;
  }

  async addRssFeedSubscription(
    workspaceId: string,
    address: string,
    title: string,
    limit: number,
    followLinks: boolean,
    contentTypes: string[]
  ): Promise<GraphQLResult<GraphQLQuery<AddRssFeedMutation>>> {
    const result = API.graphql<GraphQLQuery<AddRssFeedMutation>>({
      query: addRssFeed,
      variables: {
        input: {
          workspaceId,
          address,
          title,
          limit,
          followLinks,
          contentTypes,
        },
      },
    });
    return result;
  }

  async getRssSubscriptionPosts(
    workspaceId: string,
    feedId: string,
    lastDocumentId?: string
  ): Promise<GraphQLResult<GraphQLQuery<GetRSSPostsQuery>>> {
    const result = API.graphql<GraphQLQuery<GetRSSPostsQuery>>({
      query: getRSSPosts,
      variables: {
        input: {
          workspaceId,
          documentId: feedId,
          lastDocumentId,
        },
      },
    });
    return result;
  }

  async disableRssSubscription(
    workspaceId: string,
    feedId: string
  ): Promise<
    GraphQLResult<GraphQLQuery<SetDocumentSubscriptionStatusMutation>>
  > {
    const result = API.graphql<
      GraphQLQuery<SetDocumentSubscriptionStatusMutation>
    >({
      query: setDocumentSubscriptionStatus,
      variables: {
        input: {
          workspaceId,
          documentId: feedId,
          status: "disabled",
        },
      },
    });
    return result;
  }

  async enableRssSubscription(
    workspaceId: string,
    feedId: string
  ): Promise<
    GraphQLResult<GraphQLQuery<SetDocumentSubscriptionStatusMutation>>
  > {
    const result = API.graphql<
      GraphQLQuery<SetDocumentSubscriptionStatusMutation>
    >({
      query: setDocumentSubscriptionStatus,
      variables: {
        input: {
          workspaceId,
          documentId: feedId,
          status: "enabled",
        },
      },
    });
    return result;
  }

  async updateRssSubscriptionCrawler(
    workspaceId: string,
    feedId: string,
    followLinks: boolean,
    limit: number,
    contentTypes: string[]
  ): Promise<GraphQLResult<GraphQLQuery<UpdateRssFeedMutation>>> {
    const result = API.graphql<GraphQLQuery<UpdateRssFeedMutation>>({
      query: updateRssFeed,
      variables: {
        input: {
          workspaceId,
          documentId: feedId,
          followLinks,
          limit,
          contentTypes,
        },
      },
    });
    return result;
  }

  async deleteDocument(
    workspaceId: string,
    documentId: string
  ): Promise<GraphQLResult<GraphQLQuery<DeleteDocumentMutation>>> {
    const result = API.graphql<GraphQLQuery<DeleteDocumentMutation>>({
      query: deleteDocument,
      variables: {
        input: {
          workspaceId,
          documentId,
        },
      },
    });
    return result;
  }
}
