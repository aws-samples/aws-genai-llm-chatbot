import { API } from "aws-amplify";
import { GraphQLQuery, GraphQLResult } from "@aws-amplify/api";
import { listRoles } from "../../graphql/queries";
import { ListRolesQuery } from "../../API";

export class RolesClient {
  async getRoles(): Promise<GraphQLResult<GraphQLQuery<ListRolesQuery>>> {
    const result = await API.graphql<GraphQLQuery<ListRolesQuery>>({
      query: listRoles,
    });

    return result;
  }
}
