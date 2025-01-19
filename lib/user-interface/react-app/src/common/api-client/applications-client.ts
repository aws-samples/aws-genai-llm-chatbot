import { API } from "aws-amplify";
import { GraphQLQuery, GraphQLResult } from "@aws-amplify/api";
import { listApplications, getApplication } from "../../graphql/queries";
import {
  createApplication,
  deleteApplication,
  updateApplication,
} from "../../graphql/mutations";
import {
  ListApplicationsQuery,
  GetApplicationQuery,
  DeleteApplicationMutation,
  CreateApplicationMutation,
  UpdateApplicationMutation,
} from "../../API";

export class ApplicationsClient {
  async getApplications(): Promise<
    GraphQLResult<GraphQLQuery<ListApplicationsQuery>>
  > {
    const result = await API.graphql<GraphQLQuery<ListApplicationsQuery>>({
      query: listApplications,
    });
    return result;
  }

  async getApplication(
    id: string
  ): Promise<GraphQLResult<GraphQLQuery<GetApplicationQuery>>> {
    const result = await API.graphql<GraphQLQuery<GetApplicationQuery>>({
      query: getApplication,
      variables: {
        id: id,
      },
    });
    return result;
  }

  async deleteApplication(
    id: string
  ): Promise<GraphQLResult<GraphQLQuery<DeleteApplicationMutation>>> {
    const result = await API.graphql<GraphQLQuery<DeleteApplicationMutation>>({
      query: deleteApplication,
      variables: {
        id: id,
      },
    });
    return result;
  }

  async createApplication(params: {
    name: string;
    model: string;
    workspaceId?: string | null;
    systemPrompt?: string | null;
    systemPromptRag?: string | null;
    condenseSystemPrompt?: string | null;
    roles: Array<string | null>;
    allowImageInput: boolean;
    allowVideoInput: boolean;
    allowDocumentInput: boolean;
    enableGuardrails: boolean;
    streaming: boolean;
    maxTokens: number;
    temperature: number;
    topP: number;
    seed: number;
  }): Promise<GraphQLResult<GraphQLQuery<CreateApplicationMutation>>> {
    const result = API.graphql<GraphQLQuery<CreateApplicationMutation>>({
      query: createApplication,
      variables: {
        input: { ...params },
      },
    });
    return result;
  }

  async updateApplication(params: {
    id: string;
    name: string;
    model: string;
    workspaceId?: string | null;
    systemPrompt?: string | null;
    systemPromptRag?: string | null;
    condenseSystemPrompt?: string | null;
    roles: Array<string | null>;
    allowImageInput: boolean;
    allowVideoInput: boolean;
    allowDocumentInput: boolean;
    enableGuardrails: boolean;
    streaming: boolean;
    maxTokens: number;
    temperature: number;
    topP: number;
    seed: number;
  }): Promise<GraphQLResult<GraphQLQuery<UpdateApplicationMutation>>> {
    const result = API.graphql<GraphQLQuery<UpdateApplicationMutation>>({
      query: updateApplication,
      variables: {
        input: { ...params },
      },
    });
    return result;
  }
}
