import {
  Button,
  Container,
  Flashbar,
  FlashbarProps,
  Form,
  FormField,
  SpaceBetween,
  Textarea,
} from "@cloudscape-design/components";
import { AddDataData } from "./types";
import { useForm } from "../../../common/hooks/use-form";
import { useContext, useState } from "react";
import { AppContext } from "../../../common/app-context";
import { ApiClient } from "../../../common/api-client/api-client";
import { useNavigate } from "react-router-dom";
import { Utils } from "../../../common/utils";
import { Workspace } from "../../../API";

export interface AddQnAProps {
  data: AddDataData;
  validate: () => boolean;
  selectedWorkspace?: Workspace;
  submitting: boolean;
  setSubmitting: (submitting: boolean) => void;
}

interface AddQnAData {
  question: string;
  answer: string;
}

export default function AddQnA(props: AddQnAProps) {
  const appContext = useContext(AppContext);
  const navigate = useNavigate();
  const [globalError, setGlobalError] = useState<string | undefined>(undefined);
  const [flashbarItem, setFlashbarItem] =
    useState<FlashbarProps.MessageDefinition | null>(null);
  const { data, onChange, errors, validate } = useForm<AddQnAData>({
    initialValue: () => {
      return {
        question: "",
        answer: "",
      };
    },
    validate: (form) => {
      const errors: Record<string, string | string[]> = {};

      if (form.question.length === 0 || form.question.length > 1000) {
        errors.question = "Question must be between 1 and 1000 characters";
      }

      if (form.answer.length === 0 || form.answer.length > 1000) {
        errors.answer = "Answer must be between 1 and 1000 characters";
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
      await apiClient.documents.addQnADocument(
        props.data.workspace.value,
        data.question,
        data.answer
      );

      setFlashbarItem({
        type: "success",
        content: "Q&A added successfully",
        dismissible: true,
        onDismiss: () => setFlashbarItem(null),
        buttonText: "View Q&As",
        onButtonClick: () => {
          navigate(`/rag/workspaces/${props.data.workspace?.value}?tab=qna`);
        },
      });

      onChange({ question: "", answer: "" }, true);
      /* eslint-disable-next-line  @typescript-eslint/no-explicit-any */
    } catch (error: any) {
      console.error(Utils.getErrorMessage(error));
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
            Add Q&A
          </Button>
        </SpaceBetween>
      }
      errorText={globalError}
    >
      <SpaceBetween size="l">
        <Container>
          <SpaceBetween size="l">
            <FormField label="Question" errorText={errors.question}>
              <Textarea
                disabled={props.submitting}
                value={data.question}
                rows={5}
                onChange={({ detail: { value } }) =>
                  onChange({ question: value })
                }
              />
            </FormField>
            <FormField label="Answer" errorText={errors.answer}>
              <Textarea
                disabled={props.submitting}
                value={data.answer}
                rows={5}
                onChange={({ detail: { value } }) =>
                  onChange({ answer: value })
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
