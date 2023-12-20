import { API } from "aws-amplify";
import { GraphQLQuery, GraphQLResult } from "@aws-amplify/api";
import { listKendraIndexes, isKendraDataSynching } from "../../graphql/queries";
import { startKendraDataSync } from "../../graphql/mutations";
import {
  ListKendraIndexesQuery,
  IsKendraDataSynchingQuery,
  StartKendraDataSyncMutation,
} from "../../API";

export class KendraClient {
  async getKendraIndexes(): Promise<
    GraphQLResult<GraphQLQuery<ListKendraIndexesQuery>>
  > {
    const result = await API.graphql<GraphQLQuery<ListKendraIndexesQuery>>({
      query: listKendraIndexes,
    });
    return result;
  }

  async startKendraDataSync(
    workspaceId: string
  ): Promise<GraphQLResult<GraphQLQuery<StartKendraDataSyncMutation>>> {
    const result = await API.graphql<GraphQLQuery<StartKendraDataSyncMutation>>(
      {
        query: startKendraDataSync,
        variables: {
          workspaceId,
        },
      }
    );
    return result;
  }

  async kendraIsSyncing(
    workspaceId: string
  ): Promise<GraphQLResult<GraphQLQuery<IsKendraDataSynchingQuery>>> {
    const result = await API.graphql<GraphQLQuery<IsKendraDataSynchingQuery>>({
      query: isKendraDataSynching,
      variables: {
        workspaceId,
      },
    });
    return result;
  }
}
