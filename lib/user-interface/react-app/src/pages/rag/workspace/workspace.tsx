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
import { AppContext } from "../../../common/app-context";
import { ApiClient } from "../../../common/api-client/api-client";
import { Utils } from "../../../common/utils";
import RouterButton from "../../../components/wrappers/router-button";
import RouterButtonDropdown from "../../../components/wrappers/router-button-dropdown";
import AuroraWorkspaceSettings from "./aurora-workspace-settings";
import DocumentsTab from "./documents-tab";
import OpenSearchWorkspaceSettings from "./open-search-workspace-settings";
import KendraWorkspaceSettings from "./kendra-workspace-settings";
import { CHATBOT_NAME } from "../../../common/constants";
import { Workspace } from "../../../API";
import Badge from "@cloudscape-design/components/badge";

export default function WorkspacePane() {
  const appContext = useContext(AppContext);
  const navigate = useNavigate();
  const onFollow = useOnFollow();
  const { workspaceId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "file");
  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState<Workspace | undefined | null>(
    null
  );

  const getWorkspace = useCallback(async () => {
    if (!appContext || !workspaceId) return;

    const apiClient = new ApiClient(appContext);
    try {
      const result = await apiClient.workspaces.getWorkspace(workspaceId);
      if (!result.data?.getWorkspace) {
        navigate("/rag/workspaces");
        return;
      }
      setWorkspace(result.data!.getWorkspace);
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  }, [appContext, navigate, workspaceId]);

  useEffect(() => {
    getWorkspace();
  }, [getWorkspace]);

  const showTabs = !workspace?.kendraIndexExternal;
  const disabledTabs =
    workspace?.engine === "kendra" ? ["qna", "website", "rssfeed"] : [];

  const isWritableWorkspace = workspace?.is_writable ?? false

  return (
    <BaseAppLayout
      contentType="cards"
      breadcrumbs={
        <BreadcrumbGroup
          onFollow={onFollow}
          items={[
            {
              text: CHATBOT_NAME,
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
                    href={`/rag/semantic-search?workspaceId=${workspace?.id}`}
                  >
                    Semantic search
                  </RouterButton>
                  <RouterButtonDropdown
                    disabled={!isWritableWorkspace}
                    items={[
                      {
                        id: "upload-file",
                        text: "Upload files",
                        href: `/rag/workspaces/add-data?tab=file&workspaceId=${workspace?.id}`,
                      },
                      {
                        id: "add-text",
                        text: "Add texts",
                        href: `/rag/workspaces/add-data?tab=text&workspaceId=${workspace?.id}`,
                      },
                      {
                        id: "add-qna",
                        text: "Add Q&A",
                        href: `/rag/workspaces/add-data?tab=qna&workspaceId=${workspace?.id}`,
                      },
                      {
                        id: "crawl-website",
                        text: "Crawl website",
                        href: `/rag/workspaces/add-data?tab=website&workspaceId=${workspace?.id}`,
                      },
                      {
                        id: "add-rss-subscription",
                        text: "Add RSS subscription",
                        href: `/rag/workspaces/add-data?tab=rssfeed&workspaceId=${workspace?.id}`,
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
                <>
                    <SpaceBetween direction={"horizontal"} size={"s"}>
                        <span>{workspace?.name}</span>
                        {workspace?.is_writable == false ? <Badge color="red">ReadOnly</Badge> : ''}
                    </SpaceBetween>
                </>
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
                        workspace={workspace}
                        documentType="file"
                      />
                    ),
                  },
                  {
                    label: "Texts",
                    id: "text",
                    content: (
                      <DocumentsTab
                        workspace={workspace}
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
                        workspace={workspace}
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
                        workspace={workspace}
                        documentType="website"
                      />
                    ),
                  },
                  {
                    label: "RSS Feeds",
                    id: "rssfeed",
                    disabled: disabledTabs.includes("rssfeed"),
                    content: (
                      <DocumentsTab
                        workspace={workspace}
                        documentType="rssfeed"
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
