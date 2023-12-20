import { API } from "aws-amplify";
import { GraphQLQuery, GraphQLResult } from "@aws-amplify/api";
import { listRagEngines } from "../../graphql/queries";
import { ListRagEnginesQuery } from "../../API";

export class RagEnginesClient {
  async getRagEngines(): Promise<
    GraphQLResult<GraphQLQuery<ListRagEnginesQuery>>
  > {
    const result = await API.graphql<GraphQLQuery<ListRagEnginesQuery>>({
      query: listRagEngines,
    });
    return result;
  }
}
