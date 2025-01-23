import { StatusIndicator, TableProps } from "@cloudscape-design/components";
import RouterLink from "../../../components/wrappers/router-link";
import { Labels } from "../../../common/constants";
import { DateTime } from "luxon";
import { Workspace } from "../../../API";

export const WorkspacesColumnDefinitions: TableProps.ColumnDefinition<Workspace>[] =
  [
    {
      id: "name",
      header: "Name",
      sortingField: "name",
      cell: (item: Workspace) => (
        <RouterLink href={`/rag/workspaces/${item.id}`}>{item.name}</RouterLink>
      ),
      isRowHeader: true,
    },
    {
      id: "engine",
      header: "Engine",
      sortingField: "engine",
      cell: (item: Workspace) => Labels.engineMap[item.engine],
    },
    {
      id: "status",
      header: "Status",
      sortingField: "status",
      cell: (item) => (
        <StatusIndicator type={Labels.statusTypeMap[item.status!]}>
          {Labels.statusMap[item.status!]}
        </StatusIndicator>
      ),
      minWidth: 120,
    },
    {
      id: "documents",
      header: "Documents",
      sortingField: "documents",
      cell: (item: Workspace) => item.documents,
    },
    {
      id: "timestamp",
      header: "Creation Date",
      sortingField: "timestamp",
      cell: (item: Workspace) =>
        DateTime.fromISO(new Date(item.createdAt).toISOString()).toLocaleString(
          DateTime.DATETIME_SHORT
        ),
      sortingComparator(a, b) {
        return a.createdAt.localeCompare(b.createdAt);
      },
    },
  ];
