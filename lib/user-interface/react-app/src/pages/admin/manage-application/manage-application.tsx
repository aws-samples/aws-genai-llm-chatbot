import { useCallback, useContext, useEffect, useState } from "react";
import {
  ContentLayout,
  BreadcrumbGroup,
  SpaceBetween,
  Form,
  Button,
} from "@cloudscape-design/components";
import { AppContext } from "../../../common/app-context";
import { ApiClient } from "../../../common/api-client/api-client";
import BaseAppLayout from "../../../components/base-app-layout";
import useOnFollow from "../../../common/hooks/use-on-follow";
import { CHATBOT_NAME } from "../../../common/constants";
import { Utils } from "../../../common/utils";
import { ManageApplicationHeader } from "./manage-application-header";
import RouterButton from "../../../components/wrappers/router-button";
import ApplicationForm from "./application-form";
import { useForm } from "../../../common/hooks/use-form";
import { useNavigate, useParams } from "react-router-dom";
import { ApplicationManageInput } from "../../../common/types";
import { OptionsHelper } from "../../../common/helpers/options-helper";
import { Application } from "../../../API";

const nameRegex = /^[\w\s+_-]+$/;
const customPromptRegex = /^[A-Za-z0-9-_., !?]*$/;

const defaults: ApplicationManageInput = {
  name: "",
  selectedModel: null,
  selectedWorkspace: null,
  systemPrompt: "",
  systemPromptRag: "",
  condenseSystemPrompt: "",
  selectedRoles: [],
  allowImageInput: false,
  allowVideoInput: false,
  allowDocumentInput: false,
  enableGuardrails: true,
  streaming: true,
  maxTokens: 512,
  temperature: 0.6,
  topP: 0.9,
  seed: 0,
  createTime: undefined,
};

export default function ManageApplication() {
  const onFollow = useOnFollow();
  const navigate = useNavigate();
  const appContext = useContext(AppContext);

  const { applicationId } = useParams();
  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string | undefined>(undefined);
  const [application, setApplication] = useState<Application>();
  const [loading, setLoading] = useState(true);

  const getApplication = useCallback(async () => {
    if (!appContext || !applicationId) return;

    const apiClient = new ApiClient(appContext);
    try {
      setGlobalError(undefined);
      const result = await apiClient.applications.getApplication(applicationId);
      if (!result.data?.getApplication) {
        navigate("/admin/application");
        return;
      }
      setApplication(result.data!.getApplication);
    } catch (error) {
      console.error(Utils.getErrorMessage(error));
      setGlobalError(Utils.getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [appContext, navigate, applicationId]);

  const { data, onChange, errors, validate } = useForm({
    initialValue: () => {
      return application
        ? {
            id: applicationId,
            name: application.name,
            selectedModel: OptionsHelper.getSelectOption(
              application.model ?? ""
            ),
            selectedWorkspace: OptionsHelper.getSelectOption(
              application.workspace || ""
            ),
            systemPrompt: application.systemPrompt || "",
            systemPromptRag: application.systemPromptRag || "",
            condenseSystemPrompt: application.condenseSystemPrompt || "",
            selectedRoles: OptionsHelper.getRolesSelectOptions(
              (application.roles ?? []).filter((r): r is string => r != null)
            ),
            allowImageInput: application.allowImageInput ?? false,
            allowVideoInput: application.allowVideoInput ?? false,
            allowDocumentInput: application.allowDocumentInput ?? false,
            enableGuardrails: true,
            streaming: application.streaming ?? false,
            maxTokens: application.maxTokens ?? 512,
            temperature: application.temperature ?? 0.6,
            topP: application.topP ?? 0.9,
            seed: application.seed ?? 0,
            createTime: application.createTime ?? "",
          }
        : defaults;
    },
    validate: (form) => {
      const errors: Record<string, string | string[]> = {};
      const name = form.name.trim();

      if (name.trim().length === 0) {
        errors.name = "Application name is required";
      } else if (name.trim().length > 100) {
        errors.name = "Application name must be less than 100 characters";
      } else if (!nameRegex.test(name)) {
        errors.name =
          "Application name can only contain letters, numbers, underscores, whitespaces and dashes";
      }

      if (!form.selectedModel) {
        errors.model = "Model is required";
      }

      if (!form.selectedRoles || form.selectedRoles.length === 0) {
        errors.roles = "Role is required";
      }

      if (form.systemPrompt.length > 256) {
        errors.systemPrompt = "System prompt must be less than 256 characters";
      }
      if (form.systemPromptRag.length > 256) {
        errors.systemPromptRag =
          "System prompt with workspace must be less than 256 characters";
      }
      if (form.condenseSystemPrompt.length > 256) {
        errors.condenseSystemPrompt =
          "Condense system prompt must be less than 256 characters";
      }
      if (!customPromptRegex.test(form.systemPrompt)) {
        errors.systemPrompt = "System prompt cannot have special characters";
      }
      if (!customPromptRegex.test(form.systemPromptRag)) {
        errors.systemPromptRag =
          "System prompt with workspace cannot have special characters";
      }
      if (!customPromptRegex.test(form.condenseSystemPrompt)) {
        errors.condenseSystemPrompt =
          "Condense system prompt cannot have special characters";
      }
      return errors;
    },
  });

  useEffect(() => {
    getApplication();
  }, [getApplication]);

  useEffect(() => {
    if (
      applicationId &&
      application &&
      application.model &&
      application.roles &&
      application.roles.length > 0 &&
      application.allowImageInput !== undefined &&
      application.allowVideoInput !== undefined &&
      application.allowDocumentInput !== undefined
    ) {
      const initialValues = {
        id: applicationId,
        name: application.name,
        selectedModel: OptionsHelper.getSelectOption(application.model),
        selectedWorkspace: OptionsHelper.getSelectOption(
          application.workspace || ""
        ),
        systemPrompt: application.systemPrompt ?? "",
        systemPromptRag: application.systemPromptRag ?? "",
        condenseSystemPrompt: application.condenseSystemPrompt ?? "",
        selectedRoles: OptionsHelper.getRolesSelectOptions(
          application.roles.filter((r): r is string => r != null)
        ),
        allowImageInput: application.allowImageInput ?? false,
        allowVideoInput: application.allowVideoInput ?? false,
        allowDocumentInput: application.allowDocumentInput ?? false,
        maxTokens: application.maxTokens ?? 512,
        temperature: application.temperature ?? 0.9,
        topP: application.topP ?? 0.6,
        streaming: application.streaming ?? false,
        enableGuardrails: true,
      };
      onChange(initialValues);
    }
  }, [application, applicationId, onChange]);

  const submitForm = async () => {
    if (!validate()) return;
    if (!appContext) return;
    setGlobalError(undefined);
    setSubmitting(true);

    const selectedModel = OptionsHelper.parseValue(data.selectedModel?.value);

    const newApplicationObj = {
      name: data.name.trim(),
      model: selectedModel.provider + "::" + selectedModel.name,
      workspace: data.selectedWorkspace?.value
        ? OptionsHelper.parseWorkspaceValue(data.selectedWorkspace)
        : "",
      systemPrompt: data.systemPrompt ?? "",
      systemPromptRag: data.systemPromptRag ?? "",
      condenseSystemPrompt: data.condenseSystemPrompt ?? "",
      roles: data.selectedRoles.map((x) => x.value ?? ""),
      allowImageInput: data.allowImageInput ?? false,
      allowVideoInput: data.allowVideoInput ?? false,
      allowDocumentInput: data.allowDocumentInput ?? false,
      enableGuardrails: true,
      streaming: data.streaming ?? false,
      maxTokens: data.maxTokens ?? 512,
      temperature: data.temperature ?? 0.6,
      topP: data.topP ?? 0.9,
      seed: data.seed ?? 0,
    };

    const apiClient = new ApiClient(appContext);
    try {
      await apiClient.applications.createApplication(newApplicationObj);

      navigate("/admin/applications");
      return;
      /* eslint-disable-next-line  @typescript-eslint/no-explicit-any */
    } catch (e: any) {
      setSubmitting(false);
      console.error(
        /* eslint-disable-next-line  @typescript-eslint/no-explicit-any */
        `Invocation error: ${e.errors.map((x: any) => x.message).join("")}`
      );
      setGlobalError("Something went wrong");
    }
  };

  const submitUpdateForm = async () => {
    if (!validate()) return;
    if (!appContext) return;
    setGlobalError(undefined);
    setSubmitting(true);

    const selectedModel = OptionsHelper.parseValue(data.selectedModel?.value);
    if (!applicationId) return;

    const newApplicationObj = {
      id: applicationId || application?.id || "",
      name: data.name.trim(),
      model: selectedModel.provider + "::" + selectedModel.name,
      workspace: data.selectedWorkspace?.value
        ? OptionsHelper.parseWorkspaceValue(data.selectedWorkspace)
        : "",
      systemPrompt: data.systemPrompt ?? "",
      systemPromptRag: data.systemPromptRag ?? "",
      condenseSystemPrompt: data.condenseSystemPrompt ?? "",
      roles: data.selectedRoles.map((x) => x.value ?? ""),
      allowImageInput: data.allowImageInput ?? false,
      allowVideoInput: data.allowVideoInput ?? false,
      allowDocumentInput: data.allowDocumentInput ?? false,
      enableGuardrails: true,
      streaming: data.streaming ?? false,
      maxTokens: data.maxTokens ?? 512,
      temperature: data.temperature ?? 0.6,
      topP: data.topP ?? 0.9,
      seed: data.seed ?? 0,
    };

    const apiClient = new ApiClient(appContext);
    try {
      await apiClient.applications.updateApplication(newApplicationObj);

      navigate("/admin/applications");
      return;
      /* eslint-disable-next-line  @typescript-eslint/no-explicit-any */
    } catch (e: any) {
      setSubmitting(false);
      console.error(
        /* eslint-disable-next-line  @typescript-eslint/no-explicit-any */
        `Invocation error: ${e.errors.map((x: any) => x.message).join("")}`
      );
      setGlobalError("Something went wrong");
    }
  };

  if (Utils.isDevelopment()) {
    console.log("re-render");
  }

  const manageTitle = applicationId ? "Update" : "Create";

  return (
    <BaseAppLayout
      breadcrumbs={
        <BreadcrumbGroup
          onFollow={onFollow}
          items={[
            {
              text: CHATBOT_NAME,
              href: "/",
            },
            {
              text: "Admin",
              href: "/admin",
            },
            {
              text: "Applications",
              href: "/admin/applications",
            },
            {
              text: `${manageTitle} Application`,
              href: "/admin/applications/manage",
            },
          ]}
          expandAriaLabel="Show path"
          ariaLabel="Breadcrumbs"
        />
      }
      content={
        <ContentLayout header={<ManageApplicationHeader />}>
          <SpaceBetween size="l">
            <form onSubmit={(event) => event.preventDefault()}>
              <Form
                actions={
                  <SpaceBetween direction="horizontal" size="xs">
                    <RouterButton
                      variant="link"
                      href="/admin/applications"
                      disabled={submitting}
                    >
                      Cancel
                    </RouterButton>
                    {applicationId ? (
                      <Button
                        data-testid="update"
                        variant="primary"
                        onClick={submitUpdateForm}
                        disabled={submitting}
                      >
                        Update Application
                      </Button>
                    ) : (
                      <Button
                        data-testid="create"
                        variant="primary"
                        onClick={submitForm}
                        disabled={submitting}
                      >
                        Create Application
                      </Button>
                    )}
                  </SpaceBetween>
                }
                errorText={globalError}
              >
                <div>
                  {applicationId && loading ? (
                    <div>Loading...</div>
                  ) : (
                    <ApplicationForm
                      data={data}
                      onChange={onChange}
                      errors={errors}
                      submitting={submitting}
                    />
                  )}
                </div>
              </Form>
            </form>
          </SpaceBetween>
        </ContentLayout>
      }
    />
  );
}
