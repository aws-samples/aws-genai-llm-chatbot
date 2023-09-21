import { TableProps } from "@cloudscape-design/components";
import {
  PropertyFilterProperty,
  PropertyFilterOperator,
} from "@cloudscape-design/collection-hooks";
import { LLMItem } from "../../../common/types";

export const ModelsColumnDefinitions: TableProps.ColumnDefinition<LLMItem>[] = [
  {
    id: "name",
    header: "Name",
    sortingField: "name",
    cell: (item: LLMItem) => item.name,
    isRowHeader: true,
  },
  {
    id: "provider",
    header: "Provider",
    sortingField: "provider",
    cell: (item: LLMItem) => item.provider,
  },
  {
    id: "streaming",
    header: "Streaming",
    sortingField: "streaming",
    cell: (item: LLMItem) => (item.streaming ? "Yes" : "No"),
  },
];

export const ModelsColumnFilteringProperties: PropertyFilterProperty[] = [
  {
    propertyLabel: "Name",
    key: "name",
    groupValuesLabel: "Name values",
    operators: [":", "!:", "=", "!="] as PropertyFilterOperator[],
  },
  {
    propertyLabel: "Provider",
    key: "provider",
    groupValuesLabel: "Provider values",
    operators: [":", "!:", "=", "!="] as PropertyFilterOperator[],
  },
].sort((a, b) => a.propertyLabel.localeCompare(b.propertyLabel));
