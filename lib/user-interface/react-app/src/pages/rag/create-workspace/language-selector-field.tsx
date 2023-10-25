import {
  FormField,
  Multiselect,
  SelectProps,
} from "@cloudscape-design/components";
import { languageList } from "../../../common/constants";

interface LanguageSelectorProps {
  selectedLanguages: SelectProps.Options;
  onChange: (data: Partial<{ languages: SelectProps.Options }>) => void;
  submitting: boolean;
  errors: Record<string, string | string[]>;
}

export function LanguageSelectorField(props: LanguageSelectorProps) {
  return (
    <FormField label="Data Languages" errorText={props.errors.languages}>
      <Multiselect
        disabled={props.submitting}
        options={languageList}
        selectedOptions={props.selectedLanguages}
        placeholder="Choose data languages"
        empty={"We can't find a match"}
        filteringType="auto"
        onChange={({ detail: { selectedOptions } }) =>
          props.onChange({ languages: selectedOptions })
        }
      />
    </FormField>
  );
}
