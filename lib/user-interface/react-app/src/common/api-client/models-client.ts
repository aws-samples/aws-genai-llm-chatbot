import { API } from "aws-amplify";
import { GraphQLQuery, GraphQLResult } from "@aws-amplify/api";
import { listModels } from "../../graphql/queries";
import { ListModelsQuery } from "../../API";

export class ModelsClient {
  async getModels(): Promise<GraphQLResult<GraphQLQuery<ListModelsQuery>>> {
    try {
      const result = await API.graphql<GraphQLQuery<ListModelsQuery>>({
        query: listModels,
      });

      return result;
    } catch (error: any) {
      return error;
    }
  }
}
