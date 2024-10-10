import { OpenSearchWorkspaceCreateInput } from "../../../common/types";
import {
  Container,
  Header,
  SpaceBetween,
  FormField,
  Input,
  ExpandableSection,
} from "@cloudscape-design/components";
import EmbeddingSelector from "./embeddings-selector-field";
import { CrossEncoderSelectorField } from "./cross-encoder-selector-field";
import { ChunkSelectorField } from "./chunks-selector";
import { HybridSearchField } from "./hybrid-search-field";
import { LanguageSelectorField } from "./language-selector-field";
import { useState } from "react";

export interface OpenSearchFormProps {
  data: OpenSearchWorkspaceCreateInput;
  crossEncodingEnabled: boolean;
  onChange: (data: Partial<OpenSearchWorkspaceCreateInput>) => void;
  errors: Record<string, string | string[]>;
  submitting: boolean;
}

export function OpenSearchForm(props: OpenSearchFormProps) {
  return (
    <Container
      header={<Header variant="h2">OpenSearch Workspace Configuration</Header>}
      footer={
        <OpenSearchFooter
          data={props.data}
          crossEncodingEnabled={props.crossEncodingEnabled}
          onChange={props.onChange}
          errors={props.errors}
          submitting={props.submitting}
        />
      }
    >
      <SpaceBetween size="l">
        <FormField label="Workspace Name" errorText={props.errors.name}>
          <Input
            placeholder="My Workspace"
            disabled={props.submitting}
            value={props.data.name}
            onChange={({ detail: { value } }) =>
              props.onChange({ name: value })
            }
          />
        </FormField>
        <EmbeddingSelector
          submitting={props.submitting}
          selectedModel={props.data.embeddingsModel}
          onChange={props.onChange}
          errors={props.errors}
        />
        <LanguageSelectorField
          errors={props.errors}
          onChange={props.onChange}
          submitting={props.submitting}
          selectedLanguages={props.data.languages}
        />
      </SpaceBetween>
    </Container>
  );
}

function OpenSearchFooter(props: {
  data: OpenSearchWorkspaceCreateInput;
  crossEncodingEnabled: boolean;
  onChange: (data: Partial<OpenSearchWorkspaceCreateInput>) => void;
  errors: Record<string, string | string[]>;
  submitting: boolean;
}) {
  const [noEncodingSelected, setNoEncodingSelected] = useState(
    !props.crossEncodingEnabled
  );
  return (
    <ExpandableSection headerText="Additional settings" variant="footer">
      <SpaceBetween size="l">
        <CrossEncoderSelectorField
          errors={props.errors}
          submitting={props.submitting}
          disabled={!props.crossEncodingEnabled}
          selectedModel={props.data.crossEncoderModel}
          onChange={(data) => {
            setNoEncodingSelected(data.crossEncoderModel?.value === "__none__");
            props.onChange(data);
          }}
        />
        <HybridSearchField
          submitting={props.submitting}
          disabled={!props.crossEncodingEnabled || noEncodingSelected}
          errors={props.errors}
          checked={props.data.hybridSearch && props.crossEncodingEnabled}
          onChange={props.onChange}
        />
        <ChunkSelectorField
          submitting={props.submitting}
          onChange={props.onChange}
          data={props.data}
          errors={props.errors}
        />
      </SpaceBetween>
    </ExpandableSection>
  );
}
