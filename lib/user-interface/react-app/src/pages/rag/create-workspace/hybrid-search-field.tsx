import { FormField, Toggle } from "@cloudscape-design/components";

interface HybridSearchProps {
  submitting: boolean;
  disabled: boolean;
  onChange: (data: Partial<{ hybridSearch: boolean }>) => void;
  checked: boolean;
  errors: Record<string, string | string[]>;
}

export function HybridSearchField(props: HybridSearchProps) {
  return (
    <FormField
      label="Hybrid Search"
      description="Use vector similarity together with Open Search full-text queries for hybrid search. Cross encoding is required to rank the results."
      errorText={props.errors.hybridSearch}
    >
      <Toggle
        disabled={props.submitting || props.disabled}
        checked={props.checked}
        onChange={({ detail: { checked } }) =>
          props.onChange({ hybridSearch: checked })
        }
      >
        Use hybrid search
      </Toggle>
    </FormField>
  );
}
