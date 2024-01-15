import { Badge } from "@cloudscape-design/components";
import { Labels } from "../../../common/constants";
import { UserData } from "../../../common/types";

export const USERS_TABLE_COLUMN_DEFINITION = [
  {
    id: "name",
    header: "Name",
    cell: (user: UserData) => user.name,
    isHeaderRoe: true,
  },
  {
    id: "email",
    header: "Email",
    cell: (user: UserData) => user.email,
    isHeaderRow: true,
  },
  {
    id: "phoneNumber",
    header: "Phone Number",
    cell: (user: UserData) => user.phoneNumber,
    isHeaderRow: true,
  },
  {
    id: "role",
    header: "User Role",
    cell: (user: UserData) =>
      user.role ? Labels.getRoleName(user.role) : "Error: No Role Found",
  },
  {
    id: "status",
    header: "Status",
    cell: (user: UserData) =>
      user.userStatus
        ? user.userStatus.replace("_", " ")
        : "Error: No Status Found",
  },
  {
    id: "enabled",
    header: "User Enabled",
    cell: (user: UserData) =>
      user.enabled ? (
        <Badge color="green">Yes</Badge>
      ) : (
        <Badge color="grey">No</Badge>
      ),
  },
];

export function getUserTableColumns() {
  return USERS_TABLE_COLUMN_DEFINITION;
}
