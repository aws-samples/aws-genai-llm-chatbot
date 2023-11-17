import {
  Box,
  BreadcrumbGroup,
  Button,
  ColumnLayout,
  Container,
  ContentLayout,
  Header,
  SpaceBetween,
  StatusIndicator,
  Table,
} from "@cloudscape-design/components";
import useOnFollow from "../../../common/hooks/use-on-follow";
import BaseAppLayout from "../../../components/base-app-layout";
import { useNavigate, useParams } from "react-router-dom";
import { useCallback, useContext, useEffect, useState } from "react";
import {
  DocumentItem,
  DocumentResult,
  ResultValue,
  WorkspaceItem,
} from "../../../common/types";
import { AppContext } from "../../../common/app-context";
import { ApiClient } from "../../../common/api-client/api-client";
import { CHATBOT_NAME, Labels } from "../../../common/constants";
import { TableEmptyState } from "../../../components/table-empty-state";
import { DateTime } from "luxon";
import { Utils } from "../../../common/utils";

export default function RssFeed() {
  const appContext = useContext(AppContext);
  const navigate = useNavigate();
  const onFollow = useOnFollow();
  const { workspaceId, feedId } = useParams();
  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState<WorkspaceItem | null>(null);
  const [rssSubscription, setRssSubscription] = useState<DocumentItem | null>(
    null
  );
  const [rssSubscriptionPosts, setRssSubscriptionPosts] =
    useState<DocumentResult>({ items: [] });

  const getWorkspace = useCallback(async () => {
    if (!appContext || !workspaceId) return;
    const apiClient = new ApiClient(appContext);
    const workspaceResult =
      await apiClient.workspaces.getWorkspace(workspaceId);
    if (ResultValue.ok(workspaceResult)) {
      if (!workspaceResult.data) {
        navigate("/rag/workspaces");
        return;
      }
      setWorkspace(workspaceResult.data);
      setLoading(false);
    }
  }, [appContext, navigate, workspaceId]);

  const getRssSubscriptionDetails = useCallback(async () => {
    if (!appContext || !workspaceId || !feedId) return;
    const apiClient = new ApiClient(appContext);
    const rssSubscriptionResult = await apiClient.rss.getRssSubscriptionDetails(
      workspaceId,
      feedId
    );
    if (ResultValue.ok(rssSubscriptionResult)) {
      setRssSubscription(rssSubscriptionResult.data);
    }
    setLoading(false);
  }, [appContext, workspaceId, feedId]);

  const getRssSubscriptionPosts = useCallback(async () => {
    if (!appContext || !workspaceId || !feedId) return;
    const apiClient = new ApiClient(appContext);
    const rssSubscriptionPostsResult =
      await apiClient.rss.getRssSubscriptionPosts(workspaceId, feedId);
    if (ResultValue.ok(rssSubscriptionPostsResult)) {
      setRssSubscriptionPosts(rssSubscriptionPostsResult.data);
    }
    setLoading(false);
  }, [appContext, workspaceId, feedId]);

  const toggleRssSubscription = useCallback(
    async (toState: string) => {
      if (!appContext || !workspaceId || !feedId) return;
      setLoading(true);
      if (toState.toLowerCase() == "disable") {
        console.debug("Toggle to Disabled!");
        const apiClient = new ApiClient(appContext);
        const result = await apiClient.rss.disableRssSubscription(
          workspaceId,
          feedId
        );
        if (ResultValue.ok(result)) {
          setRssSubscription(result.data);
        }
      } else if (toState.toLowerCase() == "enable") {
        console.debug("Toggle to Enabled!");
        const apiClient = new ApiClient(appContext);
        const result = await apiClient.rss.enableRssSubscription(
          workspaceId,
          feedId
        );
        if (ResultValue.ok(result)) {
          setRssSubscription(result.data);
        }
      }
      getRssSubscriptionDetails();
      setLoading(false);
    },
    [appContext, workspaceId, feedId, getRssSubscriptionDetails]
  );

  useEffect(() => {
    getWorkspace();
    getRssSubscriptionDetails();
    getRssSubscriptionPosts();
  }, [getWorkspace, getRssSubscriptionDetails, getRssSubscriptionPosts]);

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
            {
              text: rssSubscription?.title || "",
              href: `/rag/workspaces/${workspace?.id}/rss/${rssSubscription?.id}`,
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
                <Button
                  onClick={() =>
                    toggleRssSubscription(
                      rssSubscription?.status == "enabled"
                        ? "disable"
                        : "enable"
                    )
                  }
                >
                  Toggle RSS Feed Subscription
                </Button>
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
            <Container
              header={
                <Header variant="h2">RSS Feed Subscription Details</Header>
              }
            >
              <ColumnLayout columns={2} variant="text-grid">
                <SpaceBetween size="l">
                  <div>
                    <Box variant="awsui-key-label">RSS Subscription ID</Box>
                    <div>{rssSubscription?.id}</div>
                  </div>
                  <div>
                    <Box variant="awsui-key-label">RSS Feed Title</Box>
                    <div>{rssSubscription?.title}</div>
                  </div>
                  <div>
                    <Box variant="awsui-key-label">RSS Feed URL</Box>
                    <div>{rssSubscription?.path}</div>
                  </div>
                </SpaceBetween>
                <SpaceBetween size="l">
                  <div>
                    <Box variant="awsui-key-label">RSS Subscription Status</Box>
                    <div>
                      <StatusIndicator
                        type={
                          Labels.statusTypeMap[
                            rssSubscription?.status ?? "unknown"
                          ]
                        }
                      >
                        {Labels.statusMap[rssSubscription?.status ?? "unknown"]}
                      </StatusIndicator>
                      {}
                    </div>
                  </div>
                  <div>
                    <Box variant="awsui-key-label">
                      RSS Subscription Created
                    </Box>
                    <div>
                      {rssSubscription?.createdAt
                        ? DateTime.fromISO(
                            new Date(rssSubscription?.createdAt).toISOString()
                          ).toLocaleString(DateTime.DATETIME_SHORT)
                        : ""}
                    </div>
                  </div>
                  <div>
                    <Box variant="awsui-key-label">
                      RSS Subscription Last Checked
                    </Box>
                    <div>
                      {rssSubscription?.updatedAt
                        ? DateTime.fromISO(
                            new Date(rssSubscription?.updatedAt).toISOString()
                          ).toLocaleString(DateTime.DATETIME_SHORT)
                        : ""}
                    </div>
                  </div>
                </SpaceBetween>
              </ColumnLayout>
            </Container>
            <Table
              loading={loading}
              loadingText={`Loading RSS Subscription Posts`}
              columnDefinitions={[
                {
                  id: "title",
                  header: "Title",
                  cell: (item: DocumentItem) => (
                    <>{Utils.textEllipsis(item.title ?? "", 100)}</>
                  ),
                  isRowHeader: true,
                },
                {
                  id: "url",
                  header: "URL",
                  cell: (item: DocumentItem) => (
                    <>{Utils.textEllipsis(item.path ?? "", 100)}</>
                  ),
                  isRowHeader: true,
                },
                {
                  id: "status",
                  header: "Status",
                  cell: (item: DocumentItem) => (
                    <StatusIndicator type={Labels.statusTypeMap[item.status]}>
                      {Labels.statusMap[item.status]}
                    </StatusIndicator>
                  ),
                },
                {
                  id: "createdAt",
                  header: "RSS Post Detected",
                  cell: (item: DocumentItem) =>
                    item.createdAt
                      ? DateTime.fromISO(
                          new Date(item.createdAt).toISOString()
                        ).toLocaleString(DateTime.DATETIME_SHORT)
                      : "",
                },
              ]}
              items={rssSubscriptionPosts?.items}
              empty={
                <TableEmptyState
                  resourceName="RSS Subscription Post"
                  createText="Subcribe to a new RSS Feed"
                  createHref={`/rag/workspaces/add-data?workspaceId=${rssSubscription?.workspaceId}&tab=rss`}
                />
              }
              header={
                <Header
                  actions={[
                    <SpaceBetween direction="horizontal" size="xs">
                      <Button
                        href={`/rag/workspaces/${workspace?.id}?tab=website`}
                      >
                        View Crawled Websites
                      </Button>
                      <Button
                        iconName="refresh"
                        onClick={getRssSubscriptionPosts}
                      />
                    </SpaceBetween>,
                  ]}
                  description="RSS Feed Subscriptions check for new posts daily and queues new posts for Website Crawling. Visit the Websites tab in the workspace to see the websites that have been crawled."
                >
                  Posts from RSS Feed
                </Header>
              }
            />
          </SpaceBetween>
        </ContentLayout>
      }
    />
  );
}
