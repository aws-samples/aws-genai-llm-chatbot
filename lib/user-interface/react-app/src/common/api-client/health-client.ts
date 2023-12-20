import { API } from "aws-amplify";
import { GraphQLQuery, GraphQLResult } from "@aws-amplify/api";
import { checkHealth } from "../../graphql/queries";
import { CheckHealthQuery } from "../../API";

export class HealthClient {
  async health(): Promise<GraphQLResult<GraphQLQuery<CheckHealthQuery>>> {
    const result = await API.graphql<GraphQLQuery<CheckHealthQuery>>({
      query: checkHealth,
    });
    return result;
  }
}
