import { Button, Link, StatusIndicator } from "@cloudscape-design/components";
import { RagDocumentType } from "../../../common/types";
import { Labels } from "../../../common/constants";
import { DateTime } from "luxon";
import { Utils } from "../../../common/utils";
import "../../../styles/app.scss";
import { Document } from "../../../API";

const FILES_COLUMN_DEFINITIONS = [
  {
    id: "name",
    header: "Name",
    cell: (item: Document) => item.path,
    isRowHeader: true,
  },
  {
    id: "status",
    header: "Status",
    cell: (item: Document) => (
      <StatusIndicator type={Labels.statusTypeMap[item.status!]}>
        {Labels.statusMap[item.status!]}
      </StatusIndicator>
    ),
  },
  {
    id: "createdAt",
    header: "Upload date",
    cell: (item: Document) =>
      DateTime.fromISO(new Date(item.createdAt).toISOString()).toLocaleString(
        DateTime.DATETIME_SHORT
      ),
  },
  {
    id: "size",
    header: "Size",
    cell: (item: Document) => Utils.bytesToSize(item.sizeInBytes!),
  },
];

const TEXTS_COLUMN_DEFINITIONS = [
  {
    id: "title",
    header: "Title",
    cell: (item: Document) => <>{Utils.textEllipsis(item.title ?? "", 100)}</>,
    isRowHeader: true,
  },
  {
    id: "status",
    header: "Status",
    cell: (item: Document) => (
      <StatusIndicator type={Labels.statusTypeMap[item.status!]}>
        {Labels.statusMap[item.status!]}
      </StatusIndicator>
    ),
  },
  {
    id: "createdAt",
    header: "Upload date",
    cell: (item: Document) =>
      DateTime.fromISO(new Date(item.createdAt).toISOString()).toLocaleString(
        DateTime.DATETIME_SHORT
      ),
  },
];

const RSS_COLUMN_DEFINITIONS = [
  {
    id: "title",
    header: "RSS Feed Title",
    cell: (item: Document) => (
      <Link href={item.workspaceId + "/rss/" + item.id + "/"}>
        {Utils.textEllipsis(item.title ?? "", 100)}
      </Link>
    ),
    isRowHeader: true,
  },
  {
    id: "path",
    header: "RSS Feed URL",
    cell: (item: Document) => <>{Utils.textEllipsis(item.path ?? "", 100)}</>,
    isRowHeader: true,
  },
  {
    id: "status",
    header: "RSS Subscription Status",
    cell: (item: Document) => (
      <StatusIndicator type={Labels.statusTypeMap[item.status!]}>
        {Labels.statusMap[item.status!]}
      </StatusIndicator>
    ),
  },
];

const QNA_COLUMN_DEFINITIONS = [
  {
    id: "title",
    header: "Question",
    cell: (item: Document) => <>{Utils.textEllipsis(item.title ?? "", 100)}</>,
    isRowHeader: true,
  },
  {
    id: "status",
    header: "Status",
    cell: (item: Document) => (
      <StatusIndicator type={Labels.statusTypeMap[item.status!]}>
        {Labels.statusMap[item.status!]}
      </StatusIndicator>
    ),
    isRowHeader: true,
  },
  {
    id: "createdAt",
    header: "Upload date",
    cell: (item: Document) =>
      DateTime.fromISO(new Date(item.createdAt).toISOString()).toLocaleString(
        DateTime.DATETIME_SHORT
      ),
    isRowHeader: true,
  },
];

const WEBSITES_COLUMN_DEFINITIONS = [
  {
    id: "name",
    header: "Name",
    cell: (item: Document) =>
      item.path!.length > 100
        ? item.path!.substring(0, 100) + "..."
        : item.path,
    isRowHeader: true,
  },
  {
    id: "status",
    header: "Status",
    cell: (item: Document) => (
      <StatusIndicator type={Labels.statusTypeMap[item.status!]}>
        {Labels.statusMap[item.status!]}
      </StatusIndicator>
    ),
  },
  {
    id: "subType",
    header: "Type",
    cell: (item: Document) => (
      <>{item.subType == "sitemap" ? "sitemap" : "website"}</>
    ),
    isRowHeader: true,
  },
  {
    id: "subDocuments",
    header: "Pages",
    cell: (item: Document) => item.subDocuments,
    isRowHeader: true,
  },
  {
    id: "createdAt",
    header: "Upload date",
    cell: (item: Document) =>
      DateTime.fromISO(new Date(item.createdAt).toISOString()).toLocaleString(
        DateTime.DATETIME_SHORT
      ),
  },
];

export function getColumnDefinition(
  documentType: RagDocumentType,
  handleDelete: (document: Document) => Promise<void>
) {
  const commonColumns = [
    {
      id: "deleteButton",
      header: "Delete",
      cell: (item: Document) => (
        <Button
          iconName="delete-marker"
          variant="icon"
          onClick={() => handleDelete(item)}
        />
      ),
    },
  ];
  switch (documentType) {
    case "file":
      return [...FILES_COLUMN_DEFINITIONS, ...commonColumns];
    case "text":
      return [...TEXTS_COLUMN_DEFINITIONS, ...commonColumns];
    case "qna":
      return [...QNA_COLUMN_DEFINITIONS, ...commonColumns];
    case "website":
      return [...WEBSITES_COLUMN_DEFINITIONS, ...commonColumns];
    case "rssfeed":
      return [...RSS_COLUMN_DEFINITIONS, ...commonColumns];
    default:
      return [];
  }
}
