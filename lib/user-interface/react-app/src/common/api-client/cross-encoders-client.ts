import { API } from "aws-amplify";
import { GraphQLQuery, GraphQLResult } from "@aws-amplify/api";
import { listCrossEncoders, rankPassages } from "../../graphql/queries";
import { ListCrossEncodersQuery, RankPassagesQuery } from "../../API";

export class CrossEncodersClient {
  async getModels(): Promise<
    GraphQLResult<GraphQLQuery<ListCrossEncodersQuery>>
  > {
    const result = await API.graphql<GraphQLQuery<ListCrossEncodersQuery>>({
      query: listCrossEncoders,
    });
    return result;
  }

  async getRanking(
    provider: string,
    model: string,
    input: string,
    passages: string[]
  ): Promise<GraphQLResult<GraphQLQuery<RankPassagesQuery>>> {
    const result = await API.graphql<GraphQLQuery<RankPassagesQuery>>({
      query: rankPassages,
      variables: {
        input: {
          model: model,
          passages: passages,
          provider: provider,
          reference: input,
        },
      },
    });
    return result;
  }
}
