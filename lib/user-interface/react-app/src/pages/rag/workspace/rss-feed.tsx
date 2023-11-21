import {
  Box,
  BreadcrumbGroup,
  Button,
  ColumnLayout,
  Container,
  ContentLayout,
  Header,
  Pagination,
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
  DocumentSubscriptionStatus,
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
  const [rssSubscription, setRssSubscription] = useState<DocumentItem | null>(
    null
  );
  const [rssSubscriptionStatus, setRssSubscriptionStatus] = useState<DocumentSubscriptionStatus>(DocumentSubscriptionStatus.DEFAULT)
  const [currentPageIndex, setCurrentPageIndex] = useState(1);
  const [pages, setPages] = useState<DocumentResult[]>([]);
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
    }
  }, [appContext, navigate, workspaceId]);

  const getRssSubscriptionPosts = useCallback(
    async (params: { lastDocumentId?: string; pageIndex?: number }) => {
    if (!appContext || !workspaceId || !feedId) return;
    const apiClient = new ApiClient(appContext);
    const result =
      await apiClient.documents.getRssSubscriptionPosts(workspaceId,feedId,params.lastDocumentId)
    if (ResultValue.ok(result)) {
      setPages((current) => {
        const foundIndex = current.findIndex(
          (c) => c.lastDocumentId === result.data.lastDocumentId
        );

        if (foundIndex !== -1) {
          current[foundIndex] = result.data;
          return [...current];
        } else if (typeof params.pageIndex !== "undefined") {
          current[params.pageIndex - 1] = result.data;
          return [...current];
        } else if (result.data.items.length === 0) {
          return current;
        } else {
          return [...current, result.data];
        }
      });
    }   

    setLoading(false);
  }, [appContext, workspaceId, feedId]);


  const getRssSubscriptionDetails = useCallback(async () => {
    if (!appContext || !workspaceId || !feedId) return;
    const apiClient = new ApiClient(appContext);
    const rssSubscriptionResult = await apiClient.documents.getDocumentDetails(
      workspaceId,
      feedId,
    );
    if (ResultValue.ok(rssSubscriptionResult) && rssSubscriptionResult.data.items) {
      setRssSubscription(rssSubscriptionResult.data.items[0]);
      setRssSubscriptionStatus(rssSubscriptionResult.data.items[0].status == "enabled" ? DocumentSubscriptionStatus.ENABLED : DocumentSubscriptionStatus.DISABLED);
    }
    
    setLoading(false);
  }, [appContext, workspaceId, feedId]);


  

  const toggleRssSubscription = useCallback(
    async (toState: string) => {
      if (!appContext || !workspaceId || !feedId) return;
      if (toState.toLowerCase() == "disable") {
        const apiClient = new ApiClient(appContext);
        const result = await apiClient.documents.disableRssSubscription(
          workspaceId,
          feedId
        );
        if (ResultValue.ok(result)) {
          setRssSubscriptionStatus(result.data.status == "enabled" ? DocumentSubscriptionStatus.ENABLED : DocumentSubscriptionStatus.DISABLED)
        }
      } else if (toState.toLowerCase() == "enable") {
        const apiClient = new ApiClient(appContext);
        const result = await apiClient.documents.enableRssSubscription(
          workspaceId,
          feedId
        );
        if (ResultValue.ok(result)) {
          setRssSubscriptionStatus(result.data.status == "enabled" ? DocumentSubscriptionStatus.ENABLED : DocumentSubscriptionStatus.DISABLED)
        }
      }
    },
    [appContext, workspaceId, feedId]
  );

  useEffect(() => {
    getRssSubscriptionDetails();
    getRssSubscriptionPosts({});
    getWorkspace();
  }, [getRssSubscriptionDetails, getRssSubscriptionPosts, getWorkspace]);

  const onNextPageClick = async () => {
    const lastDocumentId = pages[currentPageIndex - 1]?.lastDocumentId;

    if (lastDocumentId) {
      if (pages.length <= currentPageIndex) {
        await getRssSubscriptionPosts({ lastDocumentId });
      }

      setCurrentPageIndex((current) => Math.min(pages.length + 1, current + 1));
    }
  };

  const onPreviousPageClick = async () => {
    setCurrentPageIndex((current) =>
      Math.max(1, Math.min(pages.length - 1, current - 1))
    );
  };

  const refreshPage = async () => {
    if (currentPageIndex <= 1) {
      await getRssSubscriptionPosts({ pageIndex: currentPageIndex });
    } else {
      const lastDocumentId = pages[currentPageIndex - 2]?.lastDocumentId;
      await getRssSubscriptionPosts({ lastDocumentId });
    }
  };

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
                      rssSubscriptionStatus == DocumentSubscriptionStatus.ENABLED
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
                          Labels.statusTypeMap[rssSubscriptionStatus]
                        }
                      >
                        {Labels.statusMap[rssSubscriptionStatus]}
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
                      {rssSubscription?.rssLastCheckedAt
                        ? DateTime.fromISO(
                            new Date(rssSubscription?.rssLastCheckedAt).toISOString()
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
              items={pages[Math.min(pages.length - 1, currentPageIndex - 1)]?.items}
              empty={
                <TableEmptyState
                  resourceName="RSS Subscription Post"
                  createText="Subcribe to a new RSS Feed"
                  createHref={`/rag/workspaces/add-data?workspaceId=${rssSubscription?.workspaceId}&tab=rssfeed`}
                />
              }
              pagination={
                pages.length === 0 ? null : (
                  <Pagination
                    openEnd={true}
                    pagesCount={0}
                    currentPageIndex={currentPageIndex}
                    onNextPageClick={onNextPageClick}
                    onPreviousPageClick={onPreviousPageClick}
                  />
                )
              }
              header={
                <Header
                  actions={[
                    <SpaceBetween direction="horizontal" size="xs">
                      <Button
                        href={`/rag/workspaces/${workspaceId}?tab=website`}
                      >
                        View Crawled Websites
                      </Button>
                      <Button
                        iconName="refresh"
                        onClick={refreshPage}
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
