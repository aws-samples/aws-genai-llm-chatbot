import { useContext, useEffect, useState } from "react";
import {
  KendraIndexItem,
  KendraWorkspaceCreateInput,
  LoadingStatus,
  ResultValue,
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
  const [kendraIndexes, setKendraIndexes] = useState<KendraIndexItem[]>([]);

  useEffect(() => {
    if (!appContext) return;

    (async () => {
      const apiClient = new ApiClient(appContext);
      const result = await apiClient.ragEngines.getKendraIndexes();

      if (ResultValue.ok(result)) {
        const data = result.data?.sort((a, b) => a.name.localeCompare(b.name));
        setKendraIndexes(data);
        setKendraIndexStatus("finished");
      } else {
        setKendraIndexStatus("error");
      }
    })();
  }, [appContext]);

  const kendraIndexOptions: SelectProps.Option[] = kendraIndexes.map((item) => {
    return {
      label: item.name,
      value: item.id,
      description: item.id,
    };
  });

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
      </SpaceBetween>
    </Container>
  );
}
