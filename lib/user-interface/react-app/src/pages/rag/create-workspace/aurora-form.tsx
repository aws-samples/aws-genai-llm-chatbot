import {
  ColumnLayout,
  Container,
  ExpandableSection,
  FormField,
  Header,
  Input,
  Multiselect,
  RadioGroup,
  RadioGroupProps,
  Select,
  SpaceBetween,
  Toggle,
} from "@cloudscape-design/components";

import { languageList } from "../../../common/constants";
import {
  AuroraWorkspaceCreateInput,
  CrossEncoderModelItem,
  EmbeddingsModelItem,
  LoadingStatus,
  ResultValue,
} from "../../../common/types";
import { useContext, useEffect, useState } from "react";
import { AppContext } from "../../../common/app-context";
import { ApiClient } from "../../../common/api-client/api-client";
import { EmbeddingsModelHelper } from "../../../common/helpers/embeddings-model-helper";
import { OptionsHelper } from "../../../common/helpers/options-helper";

export interface AuroraFormProps {
  data: AuroraWorkspaceCreateInput;
  onChange: (data: Partial<AuroraWorkspaceCreateInput>) => void;
  errors: Record<string, string | string[]>;
  submitting: boolean;
  metrics: RadioGroupProps.RadioButtonDefinition[];
}

export default function AuroraForm(props: AuroraFormProps) {
  const appContext = useContext(AppContext);
  const [embeddingsModelsStatus, setEmbeddingsModelsStatus] =
    useState<LoadingStatus>("loading");
  const [embeddingsModels, setEmbeddingsModels] = useState<
    EmbeddingsModelItem[]
  >([]);

  useEffect(() => {
    if (!appContext?.config) return;

    (async () => {
      const apiClient = new ApiClient(appContext);
      const result = await apiClient.embeddings.getModels();

      if (ResultValue.ok(result)) {
        setEmbeddingsModels(result.data);
        setEmbeddingsModelsStatus("finished");
      } else {
        setEmbeddingsModelsStatus("error");
      }
    })();
  }, [appContext]);

  const embeddingsModelOptions =
    EmbeddingsModelHelper.getSelectOptions(embeddingsModels);

  return (
    <>
      <Container
        header={<Header variant="h2">Workspace Configuration</Header>}
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
          <FormField
            label="Embeddings Model"
            errorText={props.errors.embeddingsModel}
          >
            <Select
              disabled={props.submitting}
              selectedAriaLabel="Selected"
              placeholder="Choose an embeddings model"
              statusType={embeddingsModelsStatus}
              loadingText="Loading embeddings models (might take few seconds)..."
              selectedOption={props.data.embeddingsModel}
              options={embeddingsModelOptions}
              onChange={({ detail: { selectedOption } }) =>
                props.onChange({ embeddingsModel: selectedOption })
              }
            />
          </FormField>
          <FormField label="Data Languages" errorText={props.errors.languages}>
            <Multiselect
              disabled={props.submitting}
              options={languageList}
              selectedOptions={props.data.languages}
              placeholder="Choose data languages"
              empty={"We can't find a match"}
              filteringType="auto"
              onChange={({ detail: { selectedOptions } }) =>
                props.onChange({ languages: selectedOptions })
              }
            />
          </FormField>
        </SpaceBetween>
      </Container>
    </>
  );
}

function AuroraFooter(props: {
  data: AuroraWorkspaceCreateInput;
  onChange: (data: Partial<AuroraWorkspaceCreateInput>) => void;
  errors: Record<string, string | string[]>;
  submitting: boolean;
  metrics: RadioGroupProps.RadioButtonDefinition[];
}) {
  const appContext = useContext(AppContext);
  const [crossEncoderModelsStatus, setCrossEncoderModelsStatus] =
    useState<LoadingStatus>("loading");
  const [crossEncoderModels, setCrossEncoderModels] = useState<
    CrossEncoderModelItem[]
  >([]);

  useEffect(() => {
    if (!appContext) return;

    (async () => {
      const apiClient = new ApiClient(appContext);
      const result = await apiClient.crossEncoders.getModels();

      if (ResultValue.ok(result)) {
        setCrossEncoderModels(result.data);
        setCrossEncoderModelsStatus("finished");
      } else {
        setCrossEncoderModelsStatus("error");
      }
    })();
  }, [appContext]);

  const crossEncoderModelOptions =
    OptionsHelper.getSelectOptionGroups(crossEncoderModels);
  const { dimentions: embeddingsModelDimentions } =
    EmbeddingsModelHelper.parseValue(props.data.embeddingsModel?.value);

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
          description="By default, pgvector performs exact nearest neighbor search, which provides perfect recall. You can add an index to use approximate nearest neighbor search, which trades some recall for performance. Unlike typical indexes, you will see different results for queries after adding an approximate index."
          errorText={props.errors.index}
        >
          <Toggle
            disabled={props.submitting || embeddingsModelDimentions > 2000}
            checked={props.data.index}
            onChange={({ detail: { checked } }) =>
              props.onChange({ index: checked })
            }
          >
            Create an index
          </Toggle>
        </FormField>
        <FormField
          label="Hybrid Search"
          description="Use vector similarity together with Postgres full-text search for hybrid search."
          errorText={props.errors.hybridSearch}
        >
          <Toggle
            disabled={props.submitting}
            checked={props.data.hybridSearch}
            onChange={({ detail: { checked } }) =>
              props.onChange({ hybridSearch: checked })
            }
          >
            Use hybrid search
          </Toggle>
        </FormField>
        <FormField
          label="Cross-Encoder Model"
          errorText={props.errors.embeddingsModel}
        >
          <Select
            disabled={props.submitting}
            selectedAriaLabel="Selected"
            placeholder="Choose a cross-encoder model"
            statusType={crossEncoderModelsStatus}
            loadingText="Loading cross-encoder models (might take few seconds)..."
            selectedOption={props.data.crossEncoderModel}
            options={crossEncoderModelOptions}
            onChange={({ detail: { selectedOption } }) =>
              props.onChange({ crossEncoderModel: selectedOption })
            }
          />
        </FormField>
        <FormField
          label="Text Splitter"
          stretch={true}
          description="Chunk size is the character limit of each chunk, which is then vectorized."
        >
          <ColumnLayout columns={2}>
            <FormField label="Chunk Size" errorText={props.errors.chunkSize}>
              <Input
                type="number"
                disabled={props.submitting}
                value={props.data.chunkSize.toString()}
                onChange={({ detail: { value } }) =>
                  props.onChange({ chunkSize: parseInt(value) })
                }
              />
            </FormField>
            <FormField
              label="Chunk Overlap"
              errorText={props.errors.chunkOverlap}
            >
              <Input
                type="number"
                disabled={props.submitting}
                value={props.data.chunkOverlap.toString()}
                onChange={({ detail: { value } }) =>
                  props.onChange({ chunkOverlap: parseInt(value) })
                }
              />
            </FormField>
          </ColumnLayout>
        </FormField>
      </SpaceBetween>
    </ExpandableSection>
  );
}
