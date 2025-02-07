import {
  Button,
  Container,
  Flashbar,
  FlashbarProps,
  Form,
  FormField,
  Input,
  SpaceBetween,
  Textarea,
} from "@cloudscape-design/components";
import { AddDataData } from "./types";
import { useForm } from "../../../common/hooks/use-form";
import { useContext, useState } from "react";
import { AppContext } from "../../../common/app-context";
import { ApiClient } from "../../../common/api-client/api-client";
import { Utils } from "../../../common/utils";
import { useNavigate } from "react-router-dom";
import { Workspace } from "../../../API";

export interface AddTextProps {
  data: AddDataData;
  validate: () => boolean;
  selectedWorkspace?: Workspace;
  submitting: boolean;
  setSubmitting: (submitting: boolean) => void;
}

interface AddTextData {
  title: string;
  content: string;
}

export default function AddText(props: AddTextProps) {
  const appContext = useContext(AppContext);
  const navigate = useNavigate();
  const [flashbarItem, setFlashbarItem] =
    useState<FlashbarProps.MessageDefinition | null>(null);
  const [globalError, setGlobalError] = useState<string | undefined>(undefined);
  const { data, onChange, errors, validate } = useForm<AddTextData>({
    initialValue: () => {
      return {
        title: "",
        content: "",
      };
    },
    validate: (form) => {
      const errors: Record<string, string | string[]> = {};

      if (form.title.length === 0 || form.title.length > 1000) {
        errors.title = "Title must be between 1 and 1000 characters";
      }

      if (form.content.length === 0 || form.content.length > 100000) {
        errors.content = "Content must be between 1 and 100 000 characters";
      }

      return errors;
    },
  });

  const onSubmit = async () => {
    if (!appContext) return;
    let validationResult = validate();
    validationResult = props.validate() && validationResult;
    if (!validationResult) return;
    if (!props.data.workspace?.value) return;

    props.setSubmitting(true);
    setFlashbarItem(null);
    setGlobalError(undefined);

    const apiClient = new ApiClient(appContext);
    try {
      await apiClient.documents.addTextDocument(
        props.data.workspace.value,
        data.title,
        data.content
      );

      setFlashbarItem({
        type: "success",
        content: "Text added successfully",
        dismissible: true,
        onDismiss: () => setFlashbarItem(null),
        buttonText: "View texts",
        onButtonClick: () => {
          navigate(`/rag/workspaces/${props.data.workspace?.value}?tab=text`);
        },
      });

      onChange({ title: "", content: "" }, true);
      /* eslint-disable-next-line  @typescript-eslint/no-explicit-any */
    } catch (error: any) {
      console.log(Utils.getErrorMessage(error));
      setGlobalError(Utils.getErrorMessage(error));
    }

    props.setSubmitting(false);
  };

  const hasReadyWorkspace =
    typeof props.data.workspace?.value !== "undefined" &&
    typeof props.selectedWorkspace !== "undefined" &&
    props.selectedWorkspace.status === "ready";

  return (
    <Form
      actions={
        <SpaceBetween direction="horizontal" size="xs">
          <Button
            data-testid="create"
            variant="primary"
            onClick={onSubmit}
            disabled={props.submitting || !hasReadyWorkspace}
          >
            Add text
          </Button>
        </SpaceBetween>
      }
      errorText={globalError}
    >
      <SpaceBetween size="l">
        <Container>
          <SpaceBetween size="l">
            <FormField label="Title" errorText={errors.title}>
              <Input
                placeholder="My Document"
                data-locator="document-title"
                disabled={props.submitting}
                value={data.title}
                onChange={({ detail: { value } }) => onChange({ title: value })}
              />
            </FormField>
            <FormField label="Content" errorText={errors.content}>
              <Textarea
                disabled={props.submitting}
                data-locator="document-content"
                value={data.content}
                rows={15}
                onChange={({ detail: { value } }) =>
                  onChange({ content: value })
                }
              />
            </FormField>
          </SpaceBetween>
        </Container>
        {flashbarItem !== null && <Flashbar items={[flashbarItem]} />}
      </SpaceBetween>
    </Form>
  );
}
