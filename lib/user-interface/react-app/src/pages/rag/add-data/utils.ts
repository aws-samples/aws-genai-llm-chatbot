import { SelectOption, ContentTypesOptionsConfig } from "./types";

export function generateSelectedOptions(
  contentTypes: (string | undefined)[]
): SelectOption[] {
  return contentTypes.map(
    (ct): SelectOption => ({
      label: ct || "text/html",
      value: ct || "text/html",
      description:
        ContentTypesOptionsConfig[ct as keyof typeof ContentTypesOptionsConfig]
          ?.description || "Default Description",
    })
  );
}
