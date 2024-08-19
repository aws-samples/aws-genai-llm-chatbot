import { API } from "aws-amplify";
import { GraphQLQuery, GraphQLResult } from "@aws-amplify/api";
import {
  listEmbeddingModels,
  calculateEmbeddings,
} from "../../graphql/queries";
import { ListEmbeddingModelsQuery, CalculateEmbeddingsQuery } from "../../API";

export class EmbeddingsClient {
  async getModels(): Promise<
    GraphQLResult<GraphQLQuery<ListEmbeddingModelsQuery>>
  > {
    const result = await API.graphql<GraphQLQuery<ListEmbeddingModelsQuery>>({
      query: listEmbeddingModels,
    });
    return result;
  }

  async getEmbeddings(
    provider: string,
    model: string,
    input: string[],
    task: "retrieve" | "store"
  ): Promise<GraphQLResult<GraphQLQuery<CalculateEmbeddingsQuery>>> {
    const result = API.graphql<GraphQLQuery<CalculateEmbeddingsQuery>>({
      query: calculateEmbeddings,
      variables: {
        input: {
          provider: provider,
          model: model,
          passages: input,
          task: task,
        },
      },
    });
    return result;
  }
}
