import { useContext, useEffect, useState } from "react";
import {
  BedrockKBWorkspaceCreateInput,
  LoadingStatus,
} from "../../../common/types";
import {
  Container,
  Header,
  SpaceBetween,
  FormField,
  Input,
  Select,
  SelectProps,
} from "@cloudscape-design/components";
import { AppContext } from "../../../common/app-context";
import { ApiClient } from "../../../common/api-client/api-client";
import { BedrockKB } from "../../../API";
import { HybridSearchField } from "./hybrid-search-field";

export interface KBFormProps {
  data: BedrockKBWorkspaceCreateInput;
  onChange: (data: Partial<BedrockKBWorkspaceCreateInput>) => void;
  errors: Record<string, string | string[]>;
  submitting: boolean;
}

export default function KBForm(props: KBFormProps) {
  const appContext = useContext(AppContext);
  const [status, setStatus] = useState<LoadingStatus>();

  const [knowledgeBases, setKnowledgeBases] = useState<
    BedrockKB[] | null | undefined
  >([]);

  useEffect(() => {
    if (!appContext) return;

    (async () => {
      const apiClient = new ApiClient(appContext);
      try {
        const result = await apiClient.bedrockKB.listKnowledgeBases();
        const data = result.data?.listBedrockKnowledgeBases.sort((a, b) =>
          a.name.localeCompare(b.name)
        );
        setKnowledgeBases(data);
        setStatus("finished");
      } catch (error) {
        setStatus("error");
        console.error(error);
      }
    })();
  }, [appContext]);

  const kbOptions: SelectProps.Option[] = knowledgeBases
    ? knowledgeBases.map((item) => {
        return {
          label: item.name,
          value: item.id,
          description: item.id,
        };
      })
    : [];

  return (
    <Container
      header={
        <Header variant="h2">
          Bedrock Knowledge Base Workspace Configuration
        </Header>
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
          label="Knowledge Base Id"
          errorText={props.errors.knowledgeBaseId}
        >
          <Select
            disabled={props.submitting}
            selectedAriaLabel="Selected"
            placeholder="Choose Knowledge Base"
            statusType={status}
            loadingText="Loading indexes (might take few seconds)..."
            selectedOption={props.data.knowledgeBaseId}
            options={kbOptions}
            onChange={({ detail: { selectedOption } }) =>
              props.onChange({ knowledgeBaseId: selectedOption })
            }
          />
        </FormField>
        <HybridSearchField
          disabled={props.submitting}
          submitting={props.submitting}
          errors={props.errors}
          checked={props.data.hybridSearch}
          onChange={props.onChange}
        />
      </SpaceBetween>
    </Container>
  );
}
