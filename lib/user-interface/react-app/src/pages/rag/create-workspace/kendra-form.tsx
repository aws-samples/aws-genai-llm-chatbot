import { useContext, useEffect, useState } from "react";
import {
  KendraWorkspaceCreateInput,
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
  Toggle,
} from "@cloudscape-design/components";
import { AppContext } from "../../../common/app-context";
import { ApiClient } from "../../../common/api-client/api-client";
import { KendraIndex } from "../../../API";

export interface KendraFormProps {
  data: KendraWorkspaceCreateInput;
  onChange: (data: Partial<KendraWorkspaceCreateInput>) => void;
  errors: Record<string, string | string[]>;
  submitting: boolean;
}

export default function KendraForm(props: KendraFormProps) {
  const appContext = useContext(AppContext);
  const [kendraIndexStatus, setKendraIndexStatus] =
    useState<LoadingStatus>("loading");
  const [kendraIndexes, setKendraIndexes] = useState<
    KendraIndex[] | null | undefined
  >([]);

  useEffect(() => {
    if (!appContext) return;

    (async () => {
      const apiClient = new ApiClient(appContext);
      try {
        const result = await apiClient.kendra.getKendraIndexes();

        const data = result.data?.listKendraIndexes.sort((a, b) =>
          a.name.localeCompare(b.name)
        );
        setKendraIndexes(data);
        setKendraIndexStatus("finished");
      } catch (error) {
        setKendraIndexStatus("error");
        console.error(error);
      }
    })();
  }, [appContext]);

  const kendraIndexOptions: SelectProps.Option[] = kendraIndexes
    ? kendraIndexes.map((item) => {
        return {
          label: item.name,
          value: item.id,
          description: item.id,
        };
      })
    : [];

  const externalSelected = kendraIndexes
    ? kendraIndexes.find((c) => c.id === props.data.kendraIndex?.value)
        ?.external === true
    : false;

  return (
    <Container
      header={<Header variant="h2">Kendra Workspace Configuration</Header>}
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
        <FormField label="Kendra Index" errorText={props.errors.kendraIndex}>
          <Select
            disabled={props.submitting}
            selectedAriaLabel="Selected"
            placeholder="Choose Kendra index"
            statusType={kendraIndexStatus}
            loadingText="Loading indexes (might take few seconds)..."
            selectedOption={props.data.kendraIndex}
            options={kendraIndexOptions}
            onChange={({ detail: { selectedOption } }) =>
              props.onChange({ kendraIndex: selectedOption })
            }
          />
        </FormField>
        <FormField
          label="Use all data in the Kendra index"
          description="By default, only data uploaded to the Workspace is used. This approach allows us to isolate workspaces that utilize the same Kendra index. However, if desired, you can choose to use all the data in the index. This option is particularly useful when you have other Kendra data sources."
          errorText={props.errors.index}
        >
          <Toggle
            disabled={props.submitting || externalSelected}
            checked={props.data.useAllData || externalSelected}
            onChange={({ detail: { checked } }) =>
              props.onChange({ useAllData: checked })
            }
          >
            Use all data
          </Toggle>
        </FormField>
      </SpaceBetween>
    </Container>
  );
}
