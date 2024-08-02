import { SelectProps } from "@cloudscape-design/components";

export interface AddDataData {
  workspace: SelectProps.Option | null;
  query: string;
}

export interface SelectOption {
  label?: string;
  value?: string | undefined;
  description?: string;
}

export const ContentTypesOptionsConfig: {
  [key: string]: { description: string };
} = {
  "text/html": {
    description: "Crawl Websites",
  },
  "application/pdf": {
    description: "Crawl PDFs",
  },
};

export const multiselectOptions: SelectOption[] = Object.entries(
  ContentTypesOptionsConfig
).map(([value, { description }]) => ({
  label: value,
  value: value,
  description: description,
}));
