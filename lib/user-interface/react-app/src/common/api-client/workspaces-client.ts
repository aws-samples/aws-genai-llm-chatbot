import { API } from "aws-amplify";
import { GraphQLQuery, GraphQLResult } from "@aws-amplify/api";
import { listWorkspaces, getWorkspace } from "../../graphql/queries";
import {
  createAuroraWorkspace,
  createKendraWorkspace,
  createOpenSearchWorkspace,
  createBedrockKBWorkspace,
  deleteWorkspace,
} from "../../graphql/mutations";
import {
  ListWorkspacesQuery,
  GetWorkspaceQuery,
  CreateAuroraWorkspaceMutation,
  CreateKendraWorkspaceMutation,
  CreateOpenSearchWorkspaceMutation,
  DeleteWorkspaceMutation,
  CreateBedrockKBWorkspaceMutation,
} from "../../API";

export class WorkspacesClient {
  async getWorkspaces(): Promise<
    GraphQLResult<GraphQLQuery<ListWorkspacesQuery>>
  > {
    const result = await API.graphql<GraphQLQuery<ListWorkspacesQuery>>({
      query: listWorkspaces,
    });
    return result;
  }

  async getWorkspace(
    workspaceId: string
  ): Promise<GraphQLResult<GraphQLQuery<GetWorkspaceQuery>>> {
    const result = await API.graphql<GraphQLQuery<GetWorkspaceQuery>>({
      query: getWorkspace,
      variables: {
        workspaceId: workspaceId,
      },
    });
    return result;
  }

  async deleteWorkspace(
    workspaceId: string
  ): Promise<GraphQLResult<GraphQLQuery<DeleteWorkspaceMutation>>> {
    const result = await API.graphql<GraphQLQuery<DeleteWorkspaceMutation>>({
      query: deleteWorkspace,
      variables: {
        workspaceId: workspaceId,
      },
    });
    return result;
  }

  async createAuroraWorkspace(params: {
    name: string;
    embeddingsModelProvider: string;
    embeddingsModelName: string;
    crossEncoderModelProvider?: string;
    crossEncoderModelName?: string;
    languages: string[];
    metric: string;
    index: boolean;
    hybridSearch: boolean;
    chunkingStrategy: string;
    chunkSize: number;
    chunkOverlap: number;
  }): Promise<GraphQLResult<GraphQLQuery<CreateAuroraWorkspaceMutation>>> {
    const result = API.graphql<GraphQLQuery<CreateAuroraWorkspaceMutation>>({
      query: createAuroraWorkspace,
      variables: {
        input: { ...params, kind: "aurora" },
      },
    });
    return result;
  }

  async createOpenSearchWorkspace(params: {
    name: string;
    embeddingsModelProvider: string;
    embeddingsModelName: string;
    crossEncoderModelProvider?: string;
    crossEncoderModelName?: string;
    languages: string[];
    hybridSearch: boolean;
    chunkingStrategy: string;
    chunkSize: number;
    chunkOverlap: number;
  }): Promise<GraphQLResult<GraphQLQuery<CreateOpenSearchWorkspaceMutation>>> {
    const result = API.graphql<GraphQLQuery<CreateOpenSearchWorkspaceMutation>>(
      {
        query: createOpenSearchWorkspace,
        variables: {
          input: { ...params, kind: "aoss" },
        },
      }
    );
    return result;
  }

  async createKendraWorkspace(params: {
    name: string;
    kendraIndexId: string;
    useAllData: boolean;
  }): Promise<GraphQLResult<GraphQLQuery<CreateKendraWorkspaceMutation>>> {
    const result = API.graphql<GraphQLQuery<CreateKendraWorkspaceMutation>>({
      query: createKendraWorkspace,
      variables: {
        input: { ...params, kind: "kendra" },
      },
    });
    return result;
  }

  async createBedrockKBWorkspace(params: {
    name: string;
    knowledgeBaseId: string;
    hybridSearch: boolean;
  }): Promise<GraphQLResult<GraphQLQuery<CreateBedrockKBWorkspaceMutation>>> {
    const result = API.graphql<GraphQLQuery<CreateBedrockKBWorkspaceMutation>>({
      query: createBedrockKBWorkspace,
      variables: {
        input: { ...params, kind: "bedrock_kb" },
      },
    });
    return result;
  }
}
