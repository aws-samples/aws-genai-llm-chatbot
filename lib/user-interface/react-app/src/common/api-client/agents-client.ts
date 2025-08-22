import { API } from "aws-amplify";
import { GraphQLQuery, GraphQLResult } from "@aws-amplify/api";
import { listAgents } from "../../graphql/queries";
import { ListAgentsQuery } from "../../API";

export class AgentsClient {
  async getAgents(): Promise<GraphQLResult<GraphQLQuery<ListAgentsQuery>>> {
    const result = await API.graphql<GraphQLQuery<ListAgentsQuery>>({
      query: listAgents,
    });

    return result;
  }
}
