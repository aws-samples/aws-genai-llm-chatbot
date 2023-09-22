import { KendraWorkspaceCreateInput } from "../../../common/types";
import {
  Container,
  Header,
  SpaceBetween,
  FormField,
  Input,
} from "@cloudscape-design/components";

export interface KendraFormProps {
  data: KendraWorkspaceCreateInput;
  onChange: (data: Partial<KendraWorkspaceCreateInput>) => void;
  errors: Record<string, string | string[]>;
  submitting: boolean;
}

export default function KendraForm(props: KendraFormProps) {
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
      </SpaceBetween>
    </Container>
  );
}
