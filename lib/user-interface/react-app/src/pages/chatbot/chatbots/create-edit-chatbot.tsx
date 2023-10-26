import {
  BreadcrumbGroup,
  Button,
  Container,
  ContentLayout,
  Form,
  FormField,
  Header,
  Input,
  Select,
  SelectProps,
  SpaceBetween,
} from "@cloudscape-design/components";
import { useContext, useEffect, useState } from "react";
import { ApiClient } from "../../../common/api-client/api-client";
import { AppContext } from "../../../common/app-context";
import {
  ApiResult,
  ChatbotCreateEditInput,
  LoadingStatus,
  ModelItem,
  ResultValue,
  WorkspaceItem,
} from "../../../common/types";
import { useForm } from "../../../common/hooks/use-form";
import useOnFollow from "../../../common/hooks/use-on-follow";
import BaseAppLayout from "../../../components/base-app-layout";
import RouterButton from "../../../components/wrappers/router-button";

const nameRegex = /^[\w+_-]+$/;

const defaults: ChatbotCreateEditInput = {
  name: "",
  title: "",
};

export default function CreateEditChatbot() {
  const onFollow = useOnFollow();
  const appContext = useContext(AppContext);
  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string | undefined>(undefined);
  const [models, setModels] = useState<ModelItem[]>([]);
  const [modelsStatus, setModelsStatus] = useState<LoadingStatus>("loading");
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [workspacesStatus, setWorkspacesStatus] =
    useState<LoadingStatus>("loading");
  const [selectedWorkspace, setSelectedWorkspace] =
    useState<SelectProps.Option>({
      label: "No workspace (RAG data source)",
      value: "",
      iconName: "close",
    });

  const { data, onChange, errors, validate } = useForm({
    initialValue: defaults,
    validate: (form) => {
      const errors: Record<string, string | string[]> = {};
      const name = form.name.trim();
      const title = form.title.trim();

      if (name.length === 0) {
        errors.name = "Name is required";
      } else if (name.length > 50) {
        errors.name = "Name must be less than 50 characters";
      } else if (!nameRegex.test(name)) {
        errors.name =
          "Name can only contain letters, numbers, underscores, and dashes";
      }

      if (title.length === 0) {
        errors.title = "Title is required";
      } else if (title.length > 50) {
        errors.title = "Title must be less than 50 characters";
      }

      return errors;
    },
  });

  useEffect(() => {
    if (!appContext) return;

    (async () => {
      const apiClient = new ApiClient(appContext);
      const [modelsResult, workspacesResult] = await Promise.all([
        apiClient.models.getModels(),
        appContext?.config.rag_enabled
          ? apiClient.workspaces.getWorkspaces()
          : Promise.resolve<ApiResult<WorkspaceItem[]>>({
              ok: true,
              data: [],
            }),
      ]);

      const models = ResultValue.ok(modelsResult) ? modelsResult.data : [];
      const workspaces = ResultValue.ok(workspacesResult)
        ? workspacesResult.data
        : [];

      setModels(models);
      setWorkspaces(workspaces);
      setModelsStatus(ResultValue.ok(modelsResult) ? "finished" : "error");
      setWorkspacesStatus(
        ResultValue.ok(workspacesResult) ? "finished" : "error"
      );
    })();
  }, [appContext]);

  const submitForm = async () => {
    if (!validate()) return;
    if (!appContext) return;

    setGlobalError(undefined);
    setSubmitting(true);
  };

  return (
    <BaseAppLayout
      breadcrumbs={
        <BreadcrumbGroup
          onFollow={onFollow}
          items={[
            {
              text: "AWS GenAI Chatbot",
              href: "/",
            },
            {
              text: "Chatbots",
              href: "/chatbot/chatbots",
            },
            {
              text: "Create Chatbot",
              href: "/chatbot/chatbots/create",
            },
          ]}
          expandAriaLabel="Show path"
          ariaLabel="Breadcrumbs"
        />
      }
      content={
        <ContentLayout
          header={
            <Header
              variant="h1"
              description="Chatbot allows for the configuration of branding and chatbot settings."
            >
              Create Chatbot
            </Header>
          }
        >
          <SpaceBetween size="l">
            <form onSubmit={(event) => event.preventDefault()}>
              <Form
                actions={
                  <SpaceBetween direction="horizontal" size="xs">
                    <RouterButton
                      variant="link"
                      href="/rag"
                      disabled={submitting}
                    >
                      Cancel
                    </RouterButton>
                    <Button
                      data-testid="create"
                      variant="primary"
                      onClick={submitForm}
                      disabled={submitting}
                    >
                      Create Chatbot
                    </Button>
                  </SpaceBetween>
                }
                errorText={globalError}
              >
                <Container
                  header={<Header variant="h2">Chatbot Configuration</Header>}
                >
                  <SpaceBetween size="l">
                    <FormField label="Name" errorText={errors.name}>
                      <Input
                        placeholder="my-chatbot"
                        disabled={submitting}
                        value={data.name}
                        onChange={({ detail: { value } }) =>
                          onChange({ name: value })
                        }
                      />
                    </FormField>
                    <FormField label="Title" errorText={errors.title}>
                      <Input
                        placeholder="My Chatbot"
                        disabled={submitting}
                        value={data.title}
                        onChange={({ detail: { value } }) =>
                          onChange({ title: value })
                        }
                      />
                      {appContext?.config.rag_enabled && (
                        <FormField
                          label="Workspace"
                          errorText={errors.kendraIndex}
                        >
                          <Select
                            disabled={submitting}
                            placeholder="Choose Workspace index"
                            statusType={workspacesStatus}
                            loadingText="Loading workspaces (might take few seconds)..."
                            selectedOption={data.kendraIndex}
                            options={workspaceOptions}
                            onChange={({ detail: { selectedOption } }) =>
                              onChange({ kendraIndex: selectedOption })
                            }
                          />
                        </FormField>
                      )}
                    </FormField>
                  </SpaceBetween>
                </Container>
              </Form>
            </form>
          </SpaceBetween>
        </ContentLayout>
      }
    />
  );
}
