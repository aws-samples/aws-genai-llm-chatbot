import { API } from "aws-amplify";
import { GraphQLQuery, GraphQLResult } from "@aws-amplify/api";
import { listBedrockKnowledgeBases } from "../../graphql/queries";
import { ListBedrockKnowledgeBasesQuery } from "../../API";

export class BedrockKBClient {
  async listKnowledgeBases(): Promise<
    GraphQLResult<GraphQLQuery<ListBedrockKnowledgeBasesQuery>>
  > {
    const result = await API.graphql<
      GraphQLQuery<ListBedrockKnowledgeBasesQuery>
    >({
      query: listBedrockKnowledgeBases,
    });
    return result;
  }
}
