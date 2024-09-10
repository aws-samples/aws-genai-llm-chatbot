import { API } from "aws-amplify";
import { GraphQLQuery, GraphQLResult } from "@aws-amplify/api";
import {
  listSessions,
  getSession,
  getUploadFileURL,
  getFileURL,
} from "../../graphql/queries";
import { deleteSession, deleteUserSessions } from "../../graphql/mutations";
import {
  ListSessionsQuery,
  GetSessionQuery,
  DeleteSessionMutation,
  DeleteUserSessionsMutation,
  GetUploadFileURLQuery,
  GetFileURLQuery,
} from "../../API";

export class SessionsClient {
  async getFileUploadSignedUrl(
    fileName: string
  ): Promise<GraphQLResult<GraphQLQuery<GetUploadFileURLQuery>>> {
    const result = API.graphql<GraphQLQuery<GetUploadFileURLQuery>>({
      query: getUploadFileURL,
      variables: {
        input: {
          fileName,
        },
      },
    });
    return result;
  }

  async getFileSignedUrl(
    fileName: string
  ): Promise<GraphQLResult<GraphQLQuery<GetFileURLQuery>>> {
    const result = API.graphql<GraphQLQuery<GetFileURLQuery>>({
      query: getFileURL,
      variables: {
        fileName,
      },
    });
    return result;
  }

  async getSessions(): Promise<GraphQLResult<GraphQLQuery<ListSessionsQuery>>> {
    const result = await API.graphql<GraphQLQuery<ListSessionsQuery>>({
      query: listSessions,
    });
    return result;
  }

  async getSession(
    sessionId: string
  ): Promise<GraphQLResult<GraphQLQuery<GetSessionQuery>>> {
    const result = await API.graphql<GraphQLQuery<GetSessionQuery>>({
      query: getSession,
      variables: {
        id: sessionId,
      },
    });
    return result;
  }

  async deleteSession(
    sessionId: string
  ): Promise<GraphQLResult<GraphQLQuery<DeleteSessionMutation>>> {
    const result = await API.graphql<GraphQLQuery<DeleteSessionMutation>>({
      query: deleteSession,
      variables: {
        id: sessionId,
      },
    });
    return result;
  }

  async deleteSessions(): Promise<
    GraphQLResult<GraphQLQuery<DeleteUserSessionsMutation>>
  > {
    const result = await API.graphql<GraphQLQuery<DeleteUserSessionsMutation>>({
      query: deleteUserSessions,
    });
    return result;
  }
}
