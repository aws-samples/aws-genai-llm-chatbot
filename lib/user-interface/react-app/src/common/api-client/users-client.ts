import { API } from "aws-amplify";
import { GraphQLQuery, GraphQLResult } from "@aws-amplify/api";
import { getUser, listUsers } from "../../graphql/queries";
import {
  createUser,
  editUser,
  toggleUser,
  resetUserPassword,
  deleteUser,
} from "../../graphql/mutations";
import {
  CreateUserMutation,
  DeleteUserMutation,
  EditUserMutation,
  GetUserQuery,
  ListUsersQuery,
  ResetUserPasswordMutation,
  ToggleUserMutation,
} from "../../API";
import { UserData, UserRole } from "../types";

export class UsersClient {
  async getUsers(): Promise<GraphQLResult<GraphQLQuery<ListUsersQuery>>> {
    const result = API.graphql<GraphQLQuery<ListUsersQuery>>({
      query: listUsers,
    });
    return result;
  }

  async getUser(
    email: string
  ): Promise<GraphQLResult<GraphQLQuery<GetUserQuery>>> {
    const result = API.graphql<GraphQLQuery<GetUserQuery>>({
      query: getUser,
      variables: {
        input: {
          email: email,
        },
      },
    });
    return result;
  }

  async createUser(
    user: UserData
  ): Promise<GraphQLResult<GraphQLQuery<CreateUserMutation>>> {
    const result = API.graphql<GraphQLQuery<CreateUserMutation>>({
      query: createUser,
      variables: {
        input: {
          email: user.email,
          name: user.name,
          role: user.role,
          phoneNumber: user.phoneNumber,
        },
      },
    });
    return result;
  }

  async updateUser(
    name: string,
    email: string,
    role: UserRole,
    phoneNumber?: string,
    previousEmail?: string
  ): Promise<GraphQLResult<GraphQLQuery<EditUserMutation>>> {
    if (!previousEmail) {
      previousEmail = email;
    }
    const result = API.graphql<GraphQLQuery<EditUserMutation>>({
      query: editUser,
      variables: {
        input: {
          email: email,
          name: name,
          role: role,
          phoneNumber: phoneNumber,
          previousEmail: previousEmail,
        },
      },
    });
    return result;
  }

  async disableUser(
    user: UserData
  ): Promise<GraphQLResult<GraphQLQuery<ToggleUserMutation>>> {
    const result = API.graphql<GraphQLQuery<ToggleUserMutation>>({
      query: toggleUser,
      variables: {
        input: {
          email: user.email,
          action: "disable",
        },
      },
    });
    return result;
  }

  async enableUser(
    user: UserData
  ): Promise<GraphQLResult<GraphQLQuery<ToggleUserMutation>>> {
    const result = API.graphql<GraphQLQuery<ToggleUserMutation>>({
      query: toggleUser,
      variables: {
        input: {
          email: user.email,
          action: "enable",
        },
      },
    });
    return result;
  }

  async deleteUser(
    user: UserData
  ): Promise<GraphQLResult<GraphQLQuery<DeleteUserMutation>>> {
    const result = API.graphql<GraphQLQuery<DeleteUserMutation>>({
      query: deleteUser,
      variables: {
        input: {
          email: user.email,
        },
      },
    });
    return result;
  }

  async resetUserPassword(
    user: UserData
  ): Promise<GraphQLResult<GraphQLQuery<ResetUserPasswordMutation>>> {
    const result = API.graphql<GraphQLQuery<ResetUserPasswordMutation>>({
      query: resetUserPassword,
      variables: {
        input: {
          email: user.email,
        },
      },
    });
    return result;
  }
}
