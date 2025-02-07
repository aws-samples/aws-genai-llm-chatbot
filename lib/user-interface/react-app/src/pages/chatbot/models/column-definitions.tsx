import { TableProps } from "@cloudscape-design/components";
import { Model } from "../../../API";

export const ModelsColumnDefinitions: TableProps.ColumnDefinition<Model>[] = [
  {
    id: "provider",
    header: "Provider",
    sortingField: "provider",
    cell: (item: Model) => item.provider,
  },
  {
    id: "name",
    header: "Name",
    sortingField: "name",
    cell: (item: Model) => item.name,
    isRowHeader: true,
  },
  {
    id: "ragSupported",
    header: "RAG Supported",
    sortingField: "ragSupported",
    cell: (item: Model) => (item.ragSupported ? "Yes" : "No"),
  },
  {
    id: "inputModalities",
    header: "Input modalities",
    sortingField: "inputModalities",
    cell: (item: Model) => item.inputModalities.join(", "),
  },
  {
    id: "outputModalities",
    header: "Output modalities",
    sortingField: "outputModalities",
    cell: (item: Model) => item.outputModalities.join(", "),
  },
  {
    id: "streaming",
    header: "Streaming",
    sortingField: "streaming",
    cell: (item: Model) => (item.streaming ? "Yes" : "No"),
  },
];
