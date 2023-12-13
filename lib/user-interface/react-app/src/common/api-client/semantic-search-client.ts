import { API } from "aws-amplify";
import { GraphQLQuery, GraphQLResult } from "@aws-amplify/api";
import { performSemanticSearch } from "../../graphql/queries";
import { PerformSemanticSearchQuery } from "../../API";

export class SemanticSearchClient {
  async query(
    workspaceId: string,
    query: string
  ): Promise<GraphQLResult<GraphQLQuery<PerformSemanticSearchQuery>>> {
    return API.graphql({
      query: performSemanticSearch,
      variables: { input: { workspaceId, query } },
    });
  }
}
