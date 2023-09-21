import { StatusIndicator } from "@cloudscape-design/components";
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

const WEBSITES_COLUMN_DEFINITIONS = [
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
    default:
      return [];
  }
}
