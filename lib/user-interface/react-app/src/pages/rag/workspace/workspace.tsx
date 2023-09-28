import {
  BreadcrumbGroup,
  ContentLayout,
  Flashbar,
  Header,
  SpaceBetween,
  StatusIndicator,
  Tabs,
} from "@cloudscape-design/components";
import useOnFollow from "../../../common/hooks/use-on-follow";
import BaseAppLayout from "../../../components/base-app-layout";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useCallback, useContext, useEffect, useState } from "react";
import { ResultValue, WorkspaceItem } from "../../../common/types";
import { AppContext } from "../../../common/app-context";
import { ApiClient } from "../../../common/api-client/api-client";
import { Utils } from "../../../common/utils";
import RouterButton from "../../../components/wrappers/router-button";
import RouterButtonDropdown from "../../../components/wrappers/router-button-dropdown";
import AuroraWorkspaceSettings from "./aurora-workspace-settings";
import DocumentsTab from "./documents-tab";
import OpenSearchWorkspaceSettings from "./open-search-workspace-settings copy";
import KendraWorkspaceSettings from "./kendra-workspace-settings";

export default function Workspace() {
  const appContext = useContext(AppContext);
  const navigate = useNavigate();
  const onFollow = useOnFollow();
  const { workspaceId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "file");
  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState<WorkspaceItem | null>(null);

  const getWorkspace = useCallback(async () => {
    if (!appContext || !workspaceId) return;

    const apiClient = new ApiClient(appContext);
    const result = await apiClient.workspaces.getWorkspace(workspaceId);

    if (ResultValue.ok(result)) {
      if (!result.data) {
        navigate("/rag/workspaces");
        return;
      }

      setWorkspace(result.data);
      setLoading(false);
    }
  }, [appContext, navigate, workspaceId]);

  useEffect(() => {
    getWorkspace();
  }, [getWorkspace]);

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
            {
              text: workspace?.name || "",
              href: `/rag/workspaces/${workspace?.id}`,
            },
          ]}
        />
      }
      content={
        <ContentLayout
          header={
            <Header
              variant="h1"
              actions={
                <SpaceBetween direction="horizontal" size="xs">
                  <RouterButton
                    href={`/rag/semantic-search?workspaceId=${workspaceId}`}
                  >
                    Semantic search
                  </RouterButton>
                  <RouterButtonDropdown
                    items={[
                      {
                        id: "upload-file",
                        text: "Upload files",
                        href: `/rag/workspaces/add-data?tab=file&workspaceId=${workspaceId}`,
                      },
                      {
                        id: "add-text",
                        text: "Add texts",
                        href: `/rag/workspaces/add-data?tab=text&workspaceId=${workspaceId}`,
                      },
                      {
                        id: "add-qna",
                        text: "Add Q&A",
                        href: `/rag/workspaces/add-data?tab=qna&workspaceId=${workspaceId}`,
                      },
                      {
                        id: "crawl-website",
                        text: "Crawl website",
                        href: `/rag/workspaces/add-data?tab=website&workspaceId=${workspaceId}`,
                      },
                    ]}
                  >
                    Add data
                  </RouterButtonDropdown>
                </SpaceBetween>
              }
            >
              {loading ? (
                <StatusIndicator type="loading">Loading...</StatusIndicator>
              ) : (
                workspace?.name
              )}
            </Header>
          }
        >
          <SpaceBetween size="l">
            {workspace && workspace.engine === "aurora" && (
              <AuroraWorkspaceSettings workspace={workspace} />
            )}
            {workspace && workspace.engine === "opensearch" && (
              <OpenSearchWorkspaceSettings workspace={workspace} />
            )}
            {workspace && workspace.engine === "kendra" && (
              <KendraWorkspaceSettings workspace={workspace} />
            )}
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
            {workspace && showTabs && (
              <Tabs
                tabs={[
                  {
                    label: "Files",
                    id: "file",
                    content: (
                      <DocumentsTab
                        workspaceId={workspaceId}
                        documentType="file"
                      />
                    ),
                  },
                  {
                    label: "Texts",
                    id: "text",
                    content: (
                      <DocumentsTab
                        workspaceId={workspaceId}
                        documentType="text"
                      />
                    ),
                  },
                  {
                    label: "Q&A",
                    id: "qna",
                    disabled: disabledTabs.includes("qna"),
                    content: (
                      <DocumentsTab
                        workspaceId={workspaceId}
                        documentType="qna"
                      />
                    ),
                  },
                  {
                    label: "Websites",
                    id: "website",
                    disabled: disabledTabs.includes("website"),
                    content: (
                      <DocumentsTab
                        workspaceId={workspaceId}
                        documentType="website"
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
