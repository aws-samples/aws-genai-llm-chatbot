import {
  BreadcrumbGroup,
  Container,
  ContentLayout,
  Flashbar,
  FormField,
  Header,
  Select,
  SpaceBetween,
  Tabs,
} from "@cloudscape-design/components";
import { useContext, useEffect, useState } from "react";
import {
  LoadingStatus,
  ResultValue,
  WorkspaceItem,
} from "../../../common/types";
import { OptionsHelper } from "../../../common/helpers/options-helper";
import BaseAppLayout from "../../../components/base-app-layout";
import useOnFollow from "../../../common/hooks/use-on-follow";
import { useForm } from "../../../common/hooks/use-form";
import { ApiClient } from "../../../common/api-client/api-client";
import { Utils } from "../../../common/utils";
import { AppContext } from "../../../common/app-context";
import { useSearchParams } from "react-router-dom";
import { AddDataData } from "./types";
import AddText from "./add-text";
import AddQnA from "./add-qna";
import CrawlWebsite from "./crawl-website";
import DataFileUpload from "./data-file-upload";

export default function AddData() {
  const onFollow = useOnFollow();
  const appContext = useContext(AppContext);
  const [searchParams, setSearchParams] = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "file");
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [workspacesLoadingStatus, setWorkspacesLoadingStatus] =
    useState<LoadingStatus>("loading");
  const { data, onChange, errors, validate } = useForm<AddDataData>({
    initialValue: () => {
      return {
        workspace: null,
        query: "",
      };
    },
    validate: (form) => {
      const errors: Record<string, string | string[]> = {};

      if (!form.workspace) {
        errors.workspace = "Workspace is required";
      }

      return errors;
    },
  });

  const workspaceOptions = OptionsHelper.getSelectOptions(workspaces || []);
  const selectedWorkspace = workspaces.find(
    (w) => w.id === data.workspace?.value
  );

  useEffect(() => {
    if (!appContext) return;

    (async () => {
      const apiClient = new ApiClient(appContext);
      const result = await apiClient.workspaces.getWorkspaces();

      if (ResultValue.ok(result)) {
        const workspaceId = searchParams.get("workspaceId");
        if (workspaceId) {
          const workspace = result.data.find(
            (workspace) => workspace.id === workspaceId
          );

          if (workspace) {
            onChange({
              workspace: { label: workspace.name, value: workspaceId },
            });
          }
        }

        setWorkspaces(result.data);
        setWorkspacesLoadingStatus("finished");
      } else {
        setWorkspacesLoadingStatus("error");
      }
    })();
  }, [appContext, onChange, searchParams]);

  if (Utils.isDevelopment()) {
    console.log("re-render");
  }

  const workspace = workspaces.find((c) => c.id === data.workspace?.value);
  const showTabs = !workspace?.kendraIndexExternal;
  const disabledTabs = workspace?.engine === "kendra" ? ["qna", "website"] : [];

  return (
    <BaseAppLayout
      contentType="cards"
      breadcrumbs={
        <BreadcrumbGroup
          onFollow={onFollow}
          items={[
            {
              text: "AWS GenAI Chatbot",
              href: "/",
            },
            {
              text: "RAG",
              href: "/rag",
            },
            {
              text: "Workspaces",
              href: "/rag/workspaces",
            },
            ...(data.workspace?.label
              ? [
                  {
                    text: data.workspace?.label,
                    href: `/rag/workspaces/${data.workspace?.value}`,
                  },
                ]
              : []),
            {
              text: "Add Data",
              href: "/rag/workspaces/add-data",
            },
          ]}
        />
      }
      content={
        <ContentLayout header={<Header variant="h1">Add Data</Header>}>
          <SpaceBetween size="l">
            <Container>
              <SpaceBetween size="l">
                <FormField label="Workspace" errorText={errors.workspace}>
                  <Select
                    loadingText="Loading workspaces (might take few seconds)..."
                    statusType={workspacesLoadingStatus}
                    placeholder="Select a workspace"
                    filteringType="auto"
                    selectedOption={data.workspace}
                    options={workspaceOptions}
                    onChange={({ detail: { selectedOption } }) => {
                      onChange({ workspace: selectedOption });
                      setSearchParams((current) => ({
                        ...Utils.urlSearchParamsToRecord(current),
                        workspaceId: selectedOption.value ?? "",
                      }));
                    }}
                    empty={"No Workspaces available"}
                  />
                </FormField>
              </SpaceBetween>
            </Container>
            {workspace?.kendraIndexExternal && (
              <Flashbar
                items={[
                  {
                    type: "info",
                    content: (
                      <>
                        Data upload is not available for external Kendra indexes
                      </>
                    ),
                  },
                ]}
              />
            )}
            {showTabs && (
              <Tabs
                tabs={[
                  {
                    label: "Upload Files",
                    id: "file",
                    content: (
                      <DataFileUpload
                        data={data}
                        validate={validate}
                        selectedWorkspace={selectedWorkspace}
                      />
                    ),
                  },
                  {
                    label: "Add Text",
                    id: "text",
                    content: (
                      <AddText
                        data={data}
                        validate={validate}
                        submitting={submitting}
                        setSubmitting={setSubmitting}
                        selectedWorkspace={selectedWorkspace}
                      />
                    ),
                  },
                  {
                    label: "Add Q&A",
                    id: "qna",
                    disabled: disabledTabs.includes("qna"),
                    content: (
                      <AddQnA
                        data={data}
                        validate={validate}
                        submitting={submitting}
                        setSubmitting={setSubmitting}
                        selectedWorkspace={selectedWorkspace}
                      />
                    ),
                  },
                  {
                    label: "Crawl Website",
                    id: "website",
                    disabled: disabledTabs.includes("website"),
                    content: (
                      <CrawlWebsite
                        data={data}
                        validate={validate}
                        submitting={submitting}
                        setSubmitting={setSubmitting}
                        selectedWorkspace={selectedWorkspace}
                      />
                    ),
                  },
                ]}
                activeTabId={activeTab}
                onChange={({ detail: { activeTabId } }) => {
                  setActiveTab(activeTabId);
                  setSearchParams((current) => ({
                    ...Utils.urlSearchParamsToRecord(current),
                    tab: activeTabId,
                  }));
                }}
              />
            )}
          </SpaceBetween>
        </ContentLayout>
      }
    />
  );
}
