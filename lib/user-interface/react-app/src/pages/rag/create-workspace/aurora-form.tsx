import {
  Container,
  ExpandableSection,
  FormField,
  Header,
  Input,
  RadioGroup,
  RadioGroupProps,
  SpaceBetween,
  Toggle,
} from "@cloudscape-design/components";

import { AuroraWorkspaceCreateInput } from "../../../common/types";

import EmbeddingSelector from "./embeddings-selector-field";
import { LanguageSelectorField } from "./language-selector-field";
import { CrossEncoderSelectorField } from "./cross-encoder-selector-field";
import { ChunkSelectorField } from "./chunks-selector";
import { HybridSearchField } from "./hybrid-search-field";

export interface AuroraFormProps {
  data: AuroraWorkspaceCreateInput;
  onChange: (data: Partial<AuroraWorkspaceCreateInput>) => void;
  errors: Record<string, string | string[]>;
  submitting: boolean;
  metrics: RadioGroupProps.RadioButtonDefinition[];
}

export default function AuroraForm(props: AuroraFormProps) {
  return (
    <Container
      header={<Header variant="h2">Aurora Workspace Configuration</Header>}
      footer={
        <AuroraFooter
          data={props.data}
          onChange={props.onChange}
          errors={props.errors}
          submitting={props.submitting}
          metrics={props.metrics}
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
          errors={props.errors}
          submitting={props.submitting}
          selectedModel={props.data.embeddingsModel}
          onChange={props.onChange}
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

function AuroraFooter(props: {
  data: AuroraWorkspaceCreateInput;
  onChange: (data: Partial<AuroraWorkspaceCreateInput>) => void;
  errors: Record<string, string | string[]>;
  submitting: boolean;
  metrics: RadioGroupProps.RadioButtonDefinition[];
}) {
  return (
    <ExpandableSection headerText="Additional settings" variant="footer">
      <SpaceBetween size="l">
        <FormField
          label="Metric (Distance Function)"
          stretch={true}
          errorText={props.errors.metric}
        >
          <RadioGroup
            items={props.metrics.map((item) => {
              return {
                ...item,
                disabled: props.submitting,
              };
            })}
            value={props.data.metric}
            onChange={({ detail: { value } }) =>
              props.onChange({ metric: value })
            }
          />
        </FormField>
        <FormField
          label="Indexing"
          description="By default, pgVector performs exact nearest neighbor search, which provides perfect recall. You can add an index to use approximate nearest neighbor search, which trades some recall for performance. Unlike typical indexes, you will see different results for queries after adding an approximate index."
          errorText={props.errors.index}
        >
          <Toggle
            disabled={props.submitting}
            checked={props.data.index}
            onChange={({ detail: { checked } }) =>
              props.onChange({ index: checked })
            }
          >
            Create an index
          </Toggle>
        </FormField>
        <HybridSearchField
          submitting={props.submitting}
          errors={props.errors}
          checked={props.data.hybridSearch}
          onChange={props.onChange}
        />
        <CrossEncoderSelectorField
          errors={props.errors}
          submitting={props.submitting}
          selectedModel={props.data.crossEncoderModel}
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
