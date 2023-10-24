import { TableProps } from "@cloudscape-design/components";
import {
  PropertyFilterProperty,
  PropertyFilterOperator,
} from "@cloudscape-design/collection-hooks";
import { ModelItem } from "../../../common/types";

export const ModelsColumnDefinitions: TableProps.ColumnDefinition<ModelItem>[] =
  [
    {
      id: "provider",
      header: "Provider",
      sortingField: "provider",
      cell: (item: ModelItem) => item.provider,
    },
    {
      id: "name",
      header: "Name",
      sortingField: "name",
      cell: (item: ModelItem) => item.name,
      isRowHeader: true,
    },
    {
      id: "ragSupported",
      header: "RAG Supported",
      sortingField: "ragSupported",
      cell: (item: ModelItem) => (item.ragSupported ? "Yes" : "No"),
    },
    {
      id: "inputModalities",
      header: "Input modalities",
      sortingField: "inputModalities",
      cell: (item: ModelItem) => item.inputModalities.join(", "),
    },
    {
      id: "outputModalities",
      header: "Output modalities",
      sortingField: "outputModalities",
      cell: (item: ModelItem) => item.outputModalities.join(", "),
    },
    {
      id: "streaming",
      header: "Streaming",
      sortingField: "streaming",
      cell: (item: ModelItem) => (item.streaming ? "Yes" : "No"),
    },
  ];

export const ModelsColumnFilteringProperties: PropertyFilterProperty[] = [
  {
    propertyLabel: "Provider",
    key: "provider",
    groupValuesLabel: "Provider values",
    operators: [":", "!:", "=", "!="] as PropertyFilterOperator[],
  },
  {
    propertyLabel: "Name",
    key: "name",
    groupValuesLabel: "Name values",
    operators: [":", "!:", "=", "!="] as PropertyFilterOperator[],
  },
  {
    propertyLabel: "RAG Supported",
    key: "ragSupported",
    groupValuesLabel: "RAG Supported values",
    operators: [":", "!:", "=", "!="] as PropertyFilterOperator[],
  },
  {
    propertyLabel: "Input modalities",
    key: "inputModalities",
    groupValuesLabel: "Input modalities values",
    operators: [":", "!:", "=", "!="] as PropertyFilterOperator[],
  },
  {
    propertyLabel: "Output modalities",
    key: "outputModalities",
    groupValuesLabel: "Output modalities values",
    operators: [":", "!:", "=", "!="] as PropertyFilterOperator[],
  },
  {
    propertyLabel: "Streaming",
    key: "streaming",
    groupValuesLabel: "Streaming values",
    operators: [":", "!:", "=", "!="] as PropertyFilterOperator[],
  },
].sort((a, b) => a.propertyLabel.localeCompare(b.propertyLabel));
