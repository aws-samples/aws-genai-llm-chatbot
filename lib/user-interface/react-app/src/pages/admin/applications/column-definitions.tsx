import { Checkbox, TableProps } from "@cloudscape-design/components";
import RouterLink from "../../../components/wrappers/router-link";
import { DateTime } from "luxon";
import { Application } from "../../../API";

export const ApplicationColumnDefinitions: TableProps.ColumnDefinition<Application>[] =
  [
    {
      id: "name",
      header: "Name",
      sortingField: "name",
      cell: (item: Application) => (
        <RouterLink href={`/application/${item.id}`}>{item.name}</RouterLink>
      ),
      isRowHeader: true,
    },
    {
      id: "model",
      header: "Model",
      sortingField: "model",
      cell: (item: Application) => item.model,
    },
    {
      id: "workspace",
      header: "Workspace",
      sortingField: "workspace",
      cell: (item: Application) => item.workspace?.split("::")[0],
    },
    {
      id: "roles",
      header: "Roles",
      sortingField: "roles",
      cell: (item: Application) => (
        <div>
          {(item.roles ?? []).map((role, index) => (
            <div key={index}>{role}</div>
          ))}
        </div>
      ),
    },
    {
      id: "image-input",
      header: "Image Input",
      sortingField: "image-input",
      cell: (item: Application) => (
        <Checkbox checked={item.allowImageInput ?? false} />
      ),
    },
    {
      id: "video-input",
      header: "Video Input",
      sortingField: "video-input",
      cell: (item: Application) => (
        <Checkbox checked={item.allowVideoInput ?? false} />
      ),
    },
    {
      id: "document-input",
      header: "Document Input",
      sortingField: "document-input",
      cell: (item: Application) => (
        <Checkbox checked={item.allowDocumentInput ?? false} />
      ),
    },
    {
      id: "created-date",
      header: "Creation Date",
      sortingField: "created-date",
      cell: (item: Application) => {
        if (!item.createTime) return "-";
        return DateTime.fromISO(
          new Date(item.createTime).toISOString()
        ).toLocaleString(DateTime.DATETIME_SHORT);
      },
      sortingComparator(a: Application, b: Application) {
        return (a.createTime || "").localeCompare(b.createTime || "");
      },
    },
  ];
