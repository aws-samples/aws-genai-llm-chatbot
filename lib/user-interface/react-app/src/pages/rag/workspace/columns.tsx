import { Link, StatusIndicator } from "@cloudscape-design/components";
import { DocumentItem, RagDocumentType } from "../../../common/types";
import { Labels } from "../../../common/constants";
import { DateTime } from "luxon";
import { Utils } from "../../../common/utils";

const FILES_COLUMN_DEFINITIONS = [
  {
    id: "name",
    header: "Name",
    cell: (item: DocumentItem) => item.path,
    isRowHeader: true,
  },
  {
    id: "status",
    header: "Status",
    cell: (item: DocumentItem) => (
      <StatusIndicator type={Labels.statusTypeMap[item.status]}>
        {Labels.statusMap[item.status]}
      </StatusIndicator>
    ),
  },
  {
    id: "createdAt",
    header: "Upload date",
    cell: (item: DocumentItem) =>
      DateTime.fromISO(new Date(item.createdAt).toISOString()).toLocaleString(
        DateTime.DATETIME_SHORT
      ),
  },
  {
    id: "size",
    header: "Size",
    cell: (item: DocumentItem) => Utils.bytesToSize(item.sizeInBytes),
  },
];

const TEXTS_COLUMN_DEFINITIONS = [
  {
    id: "title",
    header: "Title",
    cell: (item: DocumentItem) => (
      <>{Utils.textEllipsis(item.title ?? "", 100)}</>
    ),
    isRowHeader: true,
  },
  {
    id: "status",
    header: "Status",
    cell: (item: DocumentItem) => (
      <StatusIndicator type={Labels.statusTypeMap[item.status]}>
        {Labels.statusMap[item.status]}
      </StatusIndicator>
    ),
  },
  {
    id: "createdAt",
    header: "Upload date",
    cell: (item: DocumentItem) =>
      DateTime.fromISO(new Date(item.createdAt).toISOString()).toLocaleString(
        DateTime.DATETIME_SHORT
      ),
  },
];

const RSS_COLUMN_DEFINITIONS = [
  {
    id: "title",
    header: "RSS Feed Title",
    cell: (item: DocumentItem) => (
      <Link href={item.workspaceId + "/rss/" + item.id + "/"}>
        {Utils.textEllipsis(item.title ?? "", 100)}
      </Link>
    ),
    isRowHeader: true,
  },
  {
    id: "path",
    header: "RSS Feed URL",
    cell: (item: DocumentItem) => (
      <>{Utils.textEllipsis(item.path ?? "", 100)}</>
    ),
    isRowHeader: true,
  },
  {
    id: "status",
    header: "RSS Subscription Status",
    cell: (item: DocumentItem) => (
      <StatusIndicator type={Labels.statusTypeMap[item.status]}>
        {Labels.statusMap[item.status]}
      </StatusIndicator>
    ),
  },
];

const QNA_COLUMN_DEFINITIONS = [
  {
    id: "title",
    header: "Question",
    cell: (item: DocumentItem) => (
      <>{Utils.textEllipsis(item.title ?? "", 100)}</>
    ),
    isRowHeader: true,
  },
  {
    id: "status",
    header: "Status",
    cell: (item: DocumentItem) => (
      <StatusIndicator type={Labels.statusTypeMap[item.status]}>
        {Labels.statusMap[item.status]}
      </StatusIndicator>
    ),
    isRowHeader: true,
  },
  {
    id: "createdAt",
    header: "Upload date",
    cell: (item: DocumentItem) =>
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
    cell: (item: DocumentItem) =>
      item.path.length > 100 ? item.path.substring(0, 100) + "..." : item.path,
    isRowHeader: true,
  },
  {
    id: "status",
    header: "Status",
    cell: (item: DocumentItem) => (
      <StatusIndicator type={Labels.statusTypeMap[item.status]}>
        {Labels.statusMap[item.status]}
      </StatusIndicator>
    ),
  },
  {
    id: "subType",
    header: "Type",
    cell: (item: DocumentItem) => (
      <>{item.subType == "sitemap" ? "sitemap" : "website"}</>
    ),
    isRowHeader: true,
  },
  {
    id: "subDocuments",
    header: "Pages",
    cell: (item: DocumentItem) => item.subDocuments,
    isRowHeader: true,
  },
  {
    id: "createdAt",
    header: "Upload date",
    cell: (item: DocumentItem) =>
      DateTime.fromISO(new Date(item.createdAt).toISOString()).toLocaleString(
        DateTime.DATETIME_SHORT
      ),
  },
];

export function getColumnDefinition(documentType: RagDocumentType) {
  switch (documentType) {
    case "file":
      return FILES_COLUMN_DEFINITIONS;
    case "text":
      return TEXTS_COLUMN_DEFINITIONS;
    case "qna":
      return QNA_COLUMN_DEFINITIONS;
    case "website":
      return WEBSITES_COLUMN_DEFINITIONS;
    case "rssfeed":
      return RSS_COLUMN_DEFINITIONS;
    default:
      return [];
  }
}
