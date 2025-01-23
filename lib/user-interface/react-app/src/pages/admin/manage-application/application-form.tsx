import {
  Alert,
  Container,
  ExpandableSection,
  FormField,
  Header,
  Input,
  Multiselect,
  Select,
  SelectProps,
  SpaceBetween,
  StatusIndicator,
  Textarea,
  Toggle,
} from "@cloudscape-design/components";

import { ApplicationManageInput, LoadingStatus } from "../../../common/types";
import { useContext, useEffect, useState } from "react";
import { Utils } from "../../../common/utils";
import { Model, Role, Workspace } from "../../../API";
import { AppContext } from "../../../common/app-context";
import { ApiClient } from "../../../common/api-client/api-client";
import { getSelectedModelMetadata } from "../../../components/chatbot/utils";
import { OptionsHelper } from "../../../common/helpers/options-helper";
import { useNavigate } from "react-router-dom";
import { ChabotOutputModality } from "../../../components/chatbot/types";

const workspaceDefaultOptions: SelectProps.Option[] = [
  {
    label: "No workspace (RAG data source)",
    value: "",
    iconName: "close",
  },
  {
    label: "Create new workspace",
    value: "__create__",
    iconName: "add-plus",
  },
];

export interface ApplicationFormProps {
  data: ApplicationManageInput;
  onChange: (data: Partial<ApplicationManageInput>) => void;
  errors: Record<string, string | string[]>;
  submitting: boolean;
}

export default function ApplicationForm(props: ApplicationFormProps) {
  const appContext = useContext(AppContext);
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [modelsStatus, setModelsStatus] = useState<LoadingStatus>("loading");
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<SelectProps.Option | null>(
    null
  );
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspacesStatus, setWorkspacesStatus] =
    useState<LoadingStatus>("loading");
  const [selectedWorkspace, setSelectedWorkspace] =
    useState<SelectProps.Option | null>(null);
  const [selectedModelMetadata, setSelectedModelMetadata] =
    useState<Model | null>();
  const [rolesStatus, setRolesStatus] = useState<LoadingStatus>("loading");
  const [roles, setRoles] = useState<Role[]>([]);
  const [initialLoad, setInitialLoad] = useState(true);
  const [outputModality, setOutputModality] = useState<ChabotOutputModality>();

  useEffect(() => {
    if (!appContext?.config) return;

    (async () => {
      const apiClient = new ApiClient(appContext);
      try {
        const [modelsResult, workspacesResult, rolesResult] = await Promise.all(
          [
            apiClient.models.getModels(),
            apiClient.workspaces.getWorkspaces(),
            apiClient.roles.getRoles(),
          ]
        );

        const models = modelsResult.data ? modelsResult.data.listModels : [];
        setModels(models);
        setModelsStatus("finished");

        const workspaces = workspacesResult.data?.listWorkspaces || [];
        setWorkspaces(workspaces);
        setWorkspacesStatus(
          workspacesResult.errors === undefined ? "finished" : "error"
        );

        const roles = rolesResult.data ? rolesResult.data.listRoles : [];
        setRoles(roles);
        setRolesStatus("finished");

        setLoading(false);
      } catch (error) {
        console.error(Utils.getErrorMessage(error));
        setModelsStatus("error");
        setWorkspacesStatus("error");
        setRolesStatus("error");
      }
    })();
  }, [appContext]);

  useEffect(() => {
    if (!selectedModel || !models) return;
    const metadata = getSelectedModelMetadata(models, selectedModel);
    setSelectedModelMetadata(metadata);
    if ((metadata?.outputModalities?.length || 0) > 0) {
      setOutputModality(metadata!.outputModalities[0] as ChabotOutputModality);
    }
  }, [selectedModel, models]);

  useEffect(() => {
    if (!appContext?.config) return;
    const fetchApplication = async () => {
      if (props.data && props.data.id && initialLoad) {
        const apiClient = new ApiClient(appContext);
        try {
          const result = await apiClient.applications.getApplication(
            props.data.id
          );
          if (!result.data?.getApplication?.model) {
            setModelsStatus("error");
          } else {
            const selectedModelOption = {
              label: result.data?.getApplication?.model.split("::")[1],
              value: result.data?.getApplication?.model,
            };
            setSelectedModel(selectedModelOption);
          }

          if (result.data?.getApplication?.workspace) {
            const selectedWorkspace = {
              label: result.data?.getApplication?.workspace?.split("::")[0],
              value: result.data?.getApplication.workspace,
            };
            setSelectedWorkspace(selectedWorkspace);
          }
        } catch (error) {
          console.error("Error fetching application:", error);
        } finally {
          setInitialLoad(false);
        }
      }
    };

    fetchApplication();
  }, [appContext, props.data, initialLoad]);

  const langchainModels = models.filter((m) => m.interface === "langchain");
  const modelsOptions = OptionsHelper.getSelectOptionGroups(langchainModels);
  const workspaceOptions = [
    ...workspaceDefaultOptions,
    ...OptionsHelper.getSelectOptions(workspaces ?? []),
  ];
  const rolesOptions = OptionsHelper.getSelectOptions(roles);
  // When not using a bedrock models, the guardrails (Bedrock ApplyGuardrail API) is called after the full response
  // This prevents streaming capabilities.
  // For bedrock models, streaming is possible but delayed
  const isStreamingPossible =
    selectedModelMetadata?.streaming === true &&
    (selectedModelMetadata?.provider === "bedrock" ||
      !props.data.enableGuardrails);

  return (
    <Container header={<Header variant="h2">Application Configuration</Header>}>
      <SpaceBetween size="l">
        {loading && <StatusIndicator type="loading">Loading</StatusIndicator>}
        {!loading && (
          <>
            <FormField
              label="Application Name"
              description="The name will be visible to end-users."
              errorText={props.errors.name}
            >
              <Input
                placeholder="My Application"
                data-locator="name"
                disabled={props.submitting}
                value={props.data.name}
                onChange={({ detail: { value } }) =>
                  props.onChange({ name: value })
                }
              />
            </FormField>

            <FormField label="Model" errorText={props.errors.model}>
              <Select
                disabled={props.submitting}
                data-locator="select-model"
                selectedAriaLabel="Selected"
                placeholder="Choose a model"
                statusType={modelsStatus}
                loadingText="Loading models (might take few seconds)..."
                selectedOption={selectedModel}
                options={modelsOptions}
                onChange={({ detail: { selectedOption } }) => {
                  setSelectedModel(selectedOption);
                  props.onChange({ selectedModel: selectedOption });
                }}
              />
            </FormField>

            {appContext?.config.rag_enabled && (
              <FormField label="Workspace" errorText={props.errors.workspace}>
                <Select
                  disabled={!selectedModelMetadata?.ragSupported}
                  loadingText="Loading workspaces (might take few seconds)..."
                  statusType={workspacesStatus}
                  placeholder="Select a workspace (RAG data source)"
                  filteringType="auto"
                  selectedOption={selectedWorkspace}
                  options={workspaceOptions}
                  onChange={({ detail }) => {
                    if (detail.selectedOption?.value === "__create__") {
                      navigate("/rag/workspaces/create");
                    } else {
                      setSelectedWorkspace(detail.selectedOption);
                      props.onChange({
                        selectedWorkspace: detail.selectedOption,
                      });
                    }
                  }}
                  empty={"No Workspaces available"}
                />
              </FormField>
            )}

            <FormField label="Roles" errorText={props.errors.roles}>
              <Multiselect
                disabled={props.submitting}
                options={rolesOptions}
                data-locator="select-role"
                selectedOptions={props.data.selectedRoles}
                placeholder="Choose roles"
                statusType={rolesStatus}
                empty={"We can't find a match"}
                filteringType="auto"
                onChange={({ detail: { selectedOptions } }) =>
                  props.onChange({ selectedRoles: selectedOptions })
                }
              />
            </FormField>

            <ExpandableSection headerText="Model settings" variant="footer">
              <SpaceBetween size="l">
                <FormField
                  label="System Prompt. Default prompt will be used if it is not set."
                  description="The prompt is only used when no workspace is selected."
                  errorText={props.errors.systemPrompt}
                >
                  <Textarea
                    placeholder="System Prompt"
                    disabled={
                      !!selectedWorkspace &&
                      selectedWorkspace.label !==
                        "No workspace (RAG data source)"
                    }
                    value={props.data.systemPrompt}
                    onChange={({ detail: { value } }) =>
                      props.onChange({ systemPrompt: value })
                    }
                  />
                </FormField>

                <FormField
                  label="System Prompt when using a workspace. Default prompt will be used if it is not set."
                  description="The prompt is only used when a workspace is selected."
                  errorText={props.errors.systemPromptRag}
                >
                  <Textarea
                    placeholder="System Prompt with workspace"
                    disabled={
                      !selectedWorkspace ||
                      selectedWorkspace.label ===
                        "No workspace (RAG data source)"
                    }
                    value={props.data.systemPromptRag}
                    onChange={({ detail: { value } }) =>
                      props.onChange({ systemPromptRag: value })
                    }
                  />
                </FormField>

                <FormField
                  label="Condense System Prompt. Default prompt will be used if it is not set."
                  description="It condenses the user session history into one short query used by the workspace engine."
                  errorText={props.errors.condenseSystemPrompt}
                >
                  <Textarea
                    placeholder="Condense System Prompt"
                    disabled={
                      !selectedWorkspace ||
                      selectedWorkspace.label ===
                        "No workspace (RAG data source)"
                    }
                    value={props.data.condenseSystemPrompt}
                    onChange={({ detail: { value } }) =>
                      props.onChange({ condenseSystemPrompt: value })
                    }
                  />
                </FormField>
                <FormField
                  label="Image Input"
                  description="If supported by the model, an user can upload images to a session allowing the model to analyze them."
                  errorText={props.errors.allowImageInput}
                >
                  <Toggle
                    disabled={
                      props.submitting ||
                      !selectedModelMetadata?.inputModalities.includes("IMAGE")
                    }
                    checked={
                      props.data.allowImageInput &&
                      !!selectedModelMetadata?.inputModalities.includes("IMAGE")
                    }
                    onChange={({ detail: { checked } }) =>
                      props.onChange({ allowImageInput: checked })
                    }
                  >
                    Allow image input
                  </Toggle>
                </FormField>
                <FormField
                  label="Video Input"
                  description="If supported by the model, an user can upload videos to a session allowing the model to analyze them."
                  errorText={props.errors.allowVideoInput}
                >
                  <Toggle
                    disabled={
                      props.submitting ||
                      !selectedModelMetadata?.inputModalities.includes("VIDEO")
                    }
                    checked={
                      props.data.allowVideoInput &&
                      !!selectedModelMetadata?.inputModalities.includes("VIDEO")
                    }
                    onChange={({ detail: { checked } }) =>
                      props.onChange({ allowVideoInput: checked })
                    }
                  >
                    Allow video input
                  </Toggle>
                </FormField>

                <FormField
                  label="Document Input"
                  description="If supported by the model, an user can upload text documents to a session. For example, a document a can be summarized."
                  errorText={props.errors.allowDocumentInput}
                >
                  <Toggle
                    disabled={
                      props.submitting ||
                      !selectedModelMetadata?.inputModalities.includes(
                        "DOCUMENT"
                      )
                    }
                    checked={
                      props.data.allowDocumentInput &&
                      !!selectedModelMetadata?.inputModalities.includes(
                        "DOCUMENT"
                      )
                    }
                    onChange={({ detail: { checked } }) =>
                      props.onChange({ allowDocumentInput: checked })
                    }
                  >
                    Allow document input
                  </Toggle>
                </FormField>

                <FormField
                  label="Streaming"
                  description="If supported by the selected model (Guaradrails will disable streaming except for selected Bedrock models)."
                  errorText={props.errors.streaming}
                >
                  <Toggle
                    disabled={props.submitting || !isStreamingPossible}
                    checked={props.data.streaming && isStreamingPossible}
                    onChange={({ detail: { checked } }) =>
                      props.onChange({ streaming: checked })
                    }
                  >
                    Enabled
                  </Toggle>
                </FormField>
                {!outputModality && (
                  <Alert>Select a model to view extra configurations</Alert>
                )}
                {outputModality === ChabotOutputModality.Text && (
                  <>
                    <FormField
                      label="Max Tokens"
                      errorText={props.errors.maxTokens}
                      description="This is the maximum number of tokens that the LLM generates. The higher the number, the longer the response. This is strictly related to the target model."
                    >
                      <Input
                        type="number"
                        step={1}
                        value={props.data.maxTokens.toString()}
                        onChange={({ detail: { value } }) => {
                          props.onChange({ maxTokens: parseInt(value) });
                        }}
                      />
                    </FormField>

                    <FormField
                      label="Temperature"
                      errorText={props.errors.temperature}
                      description="A higher temperature setting usually results in a more varied and inventive output, but it may also raise the chances of deviating from the topic."
                    >
                      <Input
                        type="number"
                        step={0.05}
                        value={props.data.temperature.toFixed(2)}
                        onChange={({ detail: { value } }) => {
                          let floatVal = parseFloat(value);
                          floatVal = Math.min(1.0, Math.max(0.0, floatVal));

                          props.onChange({ temperature: floatVal });
                        }}
                      />
                    </FormField>

                    <FormField
                      label="Top-P"
                      errorText={props.errors.topP}
                      description="Top-P picks from the top tokens based on the sum of their probabilities. Also known as nucleus sampling, is another hyperparameter that controls the randomness of language model output. This method can produce more diverse and interesting output than traditional methods that randomly sample the entire vocabulary."
                    >
                      <Input
                        type="number"
                        step={0.1}
                        value={props.data.topP.toFixed(2)}
                        onChange={({ detail: { value } }) => {
                          let floatVal = parseFloat(value);
                          floatVal = Math.min(1.0, Math.max(0.0, floatVal));

                          props.onChange({ topP: floatVal });
                        }}
                      />
                    </FormField>
                  </>
                )}
                {outputModality &&
                  [
                    ChabotOutputModality.Image,
                    ChabotOutputModality.Video,
                  ].includes(outputModality) && (
                    <FormField
                      label="Seed"
                      errorText={props.errors.seed}
                      description="For video and image generation, a seed value can be used to generate the same output multiple times. Using a different seed value guarantees to get different generations."
                    >
                      <Input
                        type="number"
                        step={1}
                        value={props.data.seed.toString()}
                        onChange={({ detail: { value } }) => {
                          props.onChange({ seed: parseInt(value) });
                        }}
                      />
                    </FormField>
                  )}
              </SpaceBetween>
            </ExpandableSection>
          </>
        )}
      </SpaceBetween>
    </Container>
  );
}
