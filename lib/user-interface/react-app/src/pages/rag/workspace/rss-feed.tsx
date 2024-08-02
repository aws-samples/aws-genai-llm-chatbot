import {
  Alert,
  Badge,
  Box,
  BreadcrumbGroup,
  Button,
  ColumnLayout,
  Container,
  ContentLayout,
  Form,
  FormField,
  Header,
  Input,
  Pagination,
  Popover,
  SpaceBetween,
  StatusIndicator,
  Table,
  Toggle,
  Multiselect,
} from "@cloudscape-design/components";
import useOnFollow from "../../../common/hooks/use-on-follow";
import BaseAppLayout from "../../../components/base-app-layout";
import { useNavigate, useParams } from "react-router-dom";
import { multiselectOptions, SelectOption } from "../add-data/types";
import { generateSelectedOptions } from "../add-data/utils";
import { useCallback, useContext, useEffect, useState } from "react";
import { DocumentSubscriptionStatus } from "../../../common/types";
import { AppContext } from "../../../common/app-context";
import { ApiClient } from "../../../common/api-client/api-client";
import { CHATBOT_NAME, Labels } from "../../../common/constants";
import { TableEmptyState } from "../../../components/table-empty-state";
import { DateTime } from "luxon";
import { Utils } from "../../../common/utils";
import { useForm } from "../../../common/hooks/use-form";
import { Workspace, Document, DocumentsResult } from "../../../API";

export default function RssFeed() {
  const appContext = useContext(AppContext);
  const navigate = useNavigate();
  const onFollow = useOnFollow();
  const { workspaceId, feedId } = useParams();
  const [loading, setLoading] = useState(true);
  const [rssSubscription, setRssSubscription] = useState<Document | null>(null);
  const [rssSubscriptionStatus, setRssSubscriptionStatus] =
    useState<DocumentSubscriptionStatus>(DocumentSubscriptionStatus.DEFAULT);
  const [rssCrawlerFollowLinks, setRssCrawlerFollowLinks] = useState(false);
  const [rssCrawlerLimit, setRssCrawlerLimit] = useState(0);
  const [currentPageIndex, setCurrentPageIndex] = useState(1);
  const [pages, setPages] = useState<(DocumentsResult | undefined | null)[]>(
    []
  );
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [isEditingCrawlerSettings, setIsEditingCrawlerSettings] =
    useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [postsLoading, setPostsLoading] = useState(true);

  const getWorkspace = useCallback(async () => {
    if (!appContext || !workspaceId) return;

    const apiClient = new ApiClient(appContext);
    try {
      const result = await apiClient.workspaces.getWorkspace(workspaceId);

      if (!result.data?.getWorkspace) {
        navigate("/rag/workspaces");
        return;
      }

      setWorkspace(result.data?.getWorkspace);
    } catch (e) {
      console.error(e);
    }
  }, [appContext, navigate, workspaceId]);

  const getRssSubscriptionPosts = useCallback(
    async (params: { lastDocumentId?: string; pageIndex?: number }) => {
      if (!appContext || !workspaceId || !feedId) return;
      setPostsLoading(true);
      const apiClient = new ApiClient(appContext);
      try {
        const result = await apiClient.documents.getRssSubscriptionPosts(
          workspaceId,
          feedId,
          params.lastDocumentId
        );

        setPages((current) => {
          const foundIndex = current.findIndex(
            (c) =>
              c!.lastDocumentId === result.data?.getRSSPosts?.lastDocumentId
          );
          setPostsLoading(false);

          if (foundIndex !== -1) {
            current[foundIndex] = result.data?.getRSSPosts;
            return [...current];
          } else if (typeof params.pageIndex !== "undefined") {
            current[params.pageIndex - 1] = result.data?.getRSSPosts;
            return [...current];
          } else if (result.data?.getRSSPosts!.items.length === 0) {
            return current;
          } else {
            return [...current, result.data?.getRSSPosts];
          }
        });
      } catch (error) {
        console.error(Utils.getErrorMessage(error));
      }
      setLoading(false);
    },
    [appContext, workspaceId, feedId]
  );

  const getRssSubscriptionDetails = useCallback(async () => {
    if (!appContext || !workspaceId || !feedId) return;
    const apiClient = new ApiClient(appContext);
    try {
      const rssSubscriptionResult =
        await apiClient.documents.getDocumentDetails(workspaceId, feedId);
      if (rssSubscriptionResult.data?.getDocument) {
        const doc = rssSubscriptionResult.data.getDocument!;
        setRssSubscription(doc);
        setRssSubscriptionStatus(
          doc.status == "enabled"
            ? DocumentSubscriptionStatus.ENABLED
            : DocumentSubscriptionStatus.DISABLED
        );
        setRssCrawlerFollowLinks(doc.crawlerProperties?.followLinks ?? true);
        setRssCrawlerLimit(doc.crawlerProperties?.limit ?? 0);
      }
    } catch (error) {
      console.error(Utils.getErrorMessage(error));
    }
    setLoading(false);
  }, [appContext, workspaceId, feedId]);

  const toggleRssSubscription = useCallback(
    async (toState: string) => {
      if (!appContext || !workspaceId || !feedId) return;
      if (toState.toLowerCase() == "disable") {
        const apiClient = new ApiClient(appContext);
        try {
          const result = await apiClient.documents.disableRssSubscription(
            workspaceId,
            feedId
          );
          setIsEditingCrawlerSettings(false);

          setRssSubscriptionStatus(
            /* eslint-disable-next-line  @typescript-eslint/no-non-null-asserted-optional-chain */
            result.data?.setDocumentSubscriptionStatus!.status! == "enabled"
              ? DocumentSubscriptionStatus.ENABLED
              : DocumentSubscriptionStatus.DISABLED
          );
        } catch (error) {
          console.error(Utils.getErrorMessage(error));
        }
      } else if (toState.toLowerCase() == "enable") {
        const apiClient = new ApiClient(appContext);
        try {
          const result = await apiClient.documents.enableRssSubscription(
            workspaceId,
            feedId
          );
          setRssSubscriptionStatus(
            /* eslint-disable-next-line  @typescript-eslint/no-non-null-asserted-optional-chain */
            result.data?.setDocumentSubscriptionStatus!.status! == "enabled"
              ? DocumentSubscriptionStatus.ENABLED
              : DocumentSubscriptionStatus.DISABLED
          );
        } catch (error) {
          console.error(Utils.getErrorMessage(error));
        }
      }
    },
    [appContext, workspaceId, feedId]
  );

  const cancelEdit = useCallback(async () => {
    setIsEditingCrawlerSettings(false);
    setSubmitting(false);
  }, [setSubmitting, setIsEditingCrawlerSettings]);

  useEffect(() => {
    if (!isEditingCrawlerSettings && !submitting) {
      getRssSubscriptionDetails();
      getRssSubscriptionPosts({});
      getWorkspace();
    } else if (isEditingCrawlerSettings && submitting) {
      setIsEditingCrawlerSettings(false);
    }
  }, [
    getRssSubscriptionDetails,
    getRssSubscriptionPosts,
    getWorkspace,
    isEditingCrawlerSettings,
    submitting,
  ]);

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
      /* eslint-disable-next-line  @typescript-eslint/no-non-null-asserted-optional-chain */
      const lastDocumentId = pages[currentPageIndex - 2]?.lastDocumentId!;
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
                <SpaceBetween size="m" direction="horizontal">
                  <Button
                    onClick={() =>
                      toggleRssSubscription(
                        rssSubscriptionStatus ==
                          DocumentSubscriptionStatus.ENABLED
                          ? "disable"
                          : "enable"
                      )
                    }
                  >
                    {rssSubscriptionStatus == DocumentSubscriptionStatus.ENABLED
                      ? "Disable RSS Feed Subscription"
                      : "Enable RSS Feed Subscription"}
                  </Button>
                  <Button
                    onClick={() => setIsEditingCrawlerSettings(true)}
                    disabled={
                      isEditingCrawlerSettings ||
                      rssSubscriptionStatus ==
                        DocumentSubscriptionStatus.DISABLED
                    }
                  >
                    Edit Website Crawler Configuration
                  </Button>
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
            <Container
              header={
                <Header variant="h2">RSS Feed Subscription Details</Header>
              }
            >
              <SpaceBetween direction="vertical" size="s">
                {rssSubscriptionStatus ==
                DocumentSubscriptionStatus.DISABLED ? (
                  <Alert type="warning" header="RSS Feed Subscription Disabled">
                    This RSS Subscription is currently disabled and won't check
                    for any new posts from the RSS feed. To enable it, please
                    click the <b>"Enable RSS Feed Subscription"</b> button.
                    <br />
                    <i>
                      Any Posts from RSS Feed listed as "Pending" in the table
                      below will still be sent for crawling, even if
                      subscription is disabled.
                    </i>
                  </Alert>
                ) : (
                  <></>
                )}
                <ColumnLayout columns={3} variant="text-grid">
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
                      <Box variant="awsui-key-label">
                        RSS Subscription Status
                      </Box>
                      <div>
                        <StatusIndicator
                          type={Labels.statusTypeMap[rssSubscriptionStatus]}
                          colorOverride={
                            rssSubscriptionStatus ==
                            DocumentSubscriptionStatus.ENABLED
                              ? "green"
                              : "red"
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
                              new Date(
                                rssSubscription?.rssLastCheckedAt
                              ).toISOString()
                            ).toLocaleString(DateTime.DATETIME_SHORT)
                          : ""}
                      </div>
                    </div>
                  </SpaceBetween>
                  {isEditingCrawlerSettings &&
                  rssSubscriptionStatus ==
                    DocumentSubscriptionStatus.ENABLED ? (
                    <RssFeedCrawlerForm
                      data={{
                        followLinks: rssCrawlerFollowLinks,
                        limit: rssCrawlerLimit,
                        contentTypes: ["text/html"],
                      }}
                      documentId={rssSubscription?.id ?? ""}
                      workspaceId={workspace?.id ?? ""}
                      setCanceled={cancelEdit}
                      setSubmitting={setSubmitting}
                      submitting={submitting}
                    />
                  ) : (
                    <SpaceBetween size="l">
                      <div>
                        <Box variant="h4">
                          RSS Post Website Crawler Configuration
                        </Box>
                      </div>
                      <div>
                        <Box variant="awsui-key-label">Follow Links</Box>
                        <div>
                          <StatusIndicator
                            type={rssCrawlerFollowLinks ? "success" : "info"}
                            colorOverride={
                              rssSubscriptionStatus ==
                              DocumentSubscriptionStatus.ENABLED
                                ? rssCrawlerFollowLinks
                                  ? "green"
                                  : "grey"
                                : "grey"
                            }
                          >
                            {rssCrawlerFollowLinks ? "Yes" : "No"}
                          </StatusIndicator>
                        </div>
                      </div>
                      <div>
                        <Box variant="awsui-key-label">
                          Maximum Number of Links to Follow
                        </Box>
                        <div>
                          <Badge
                            color={
                              rssCrawlerFollowLinks &&
                              rssSubscriptionStatus ==
                                DocumentSubscriptionStatus.ENABLED
                                ? "blue"
                                : "grey"
                            }
                          >
                            {rssCrawlerFollowLinks ? rssCrawlerLimit : "N/A"}
                          </Badge>
                        </div>
                      </div>
                    </SpaceBetween>
                  )}
                </ColumnLayout>
              </SpaceBetween>
            </Container>
            <Table
              loading={postsLoading}
              loadingText={`Loading RSS Subscription Posts`}
              columnDefinitions={[
                {
                  id: "title",
                  header: "Title",
                  cell: (item: Document) => (
                    <>{Utils.textEllipsis(item.title ?? "", 100)}</>
                  ),
                  isRowHeader: true,
                },
                {
                  id: "url",
                  header: "URL",
                  cell: (item: Document) => (
                    <RssFeedPostUrlPopover item={item} />
                  ),
                  isRowHeader: true,
                },
                {
                  id: "status",
                  header: "Status",
                  cell: (item: Document) => (
                    <StatusIndicator type={Labels.statusTypeMap[item.status!]}>
                      {Labels.statusMap[item.status!]}
                    </StatusIndicator>
                  ),
                },
                {
                  id: "createdAt",
                  header: "RSS Post Detected",
                  cell: (item: Document) =>
                    item.createdAt
                      ? DateTime.fromISO(
                          new Date(item.createdAt).toISOString()
                        ).toLocaleString(DateTime.DATETIME_SHORT)
                      : "",
                },
              ]}
              items={
                /* eslint-disable-next-line  @typescript-eslint/no-non-null-asserted-optional-chain */
                pages[Math.min(pages.length - 1, currentPageIndex - 1)]?.items!
              }
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
                    <SpaceBetween
                      direction="horizontal"
                      size="xs"
                      key="table-header-buttons"
                    >
                      <Button
                        href={`/rag/workspaces/${workspaceId}?tab=website`}
                      >
                        View Crawled Websites
                      </Button>
                      <Button iconName="refresh" onClick={refreshPage} />
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

export interface RssFeedPostUrlPopoverProps {
  item: Document;
}

export function RssFeedPostUrlPopover(props: RssFeedPostUrlPopoverProps) {
  const item = props.item;
  const followLinks = item.crawlerProperties?.followLinks;
  const limit = item.crawlerProperties?.limit;
  const contentTypes = item.crawlerProperties?.contentTypes;
  return (
    <Popover
      dismissButton={false}
      size="large"
      content={
        <SpaceBetween size="l">
          <div>
            <Header>Link Details</Header>
          </div>
          <div>
            <Box variant="awsui-key-label">Full URL</Box>
            <div>{item.path}</div>
          </div>
          <div>
            <Box variant="awsui-key-label">Follow Links</Box>
            <div>
              <StatusIndicator
                type={followLinks == true ? "success" : "info"}
                colorOverride={followLinks ? "green" : "grey"}
              >
                {followLinks ? "Yes" : "No"}
              </StatusIndicator>
            </div>
          </div>
          {followLinks == true ? (
            <div>
              <Box variant="awsui-key-label">Max Links Allowed to Crawl</Box>
              <div>
                <Badge color="blue">{limit}</Badge>
              </div>
            </div>
          ) : (
            <></>
          )}
          <div>
            <Box variant="awsui-key-label">Content Types supported</Box>
            <div>
              <Badge color="blue">{contentTypes}</Badge>
            </div>
          </div>
          <div>
            <Box>
              <Button target="_blank" href={item.path!}>
                Visit Post
              </Button>
            </Box>
          </div>
        </SpaceBetween>
      }
    >
      {Utils.textEllipsis(item.path ?? "", 100)}
    </Popover>
  );
}

export interface RssFeedCrawlerData {
  followLinks: boolean;
  limit: number;
  contentTypes: (string | undefined)[];
}

export interface RssFeedEditorProps {
  data: RssFeedCrawlerData;
  workspaceId: string;
  documentId: string;
  submitting: boolean;
  setSubmitting: (submitting: boolean) => void;
  setCanceled: () => void;
}

export function RssFeedCrawlerForm(props: RssFeedEditorProps) {
  const appContext = useContext(AppContext);
  const { data, onChange, errors, validate } = useForm<RssFeedCrawlerData>({
    initialValue: () => {
      return {
        workspaceId: props.workspaceId,
        documentId: props.documentId,
        followLinks: props.data.followLinks,
        limit: props.data.limit,
        contentTypes: props.data.contentTypes,
      };
    },
    validate: (form) => {
      const errors: Record<string, string | string[]> = {};
      if (form.limit < 1 || form.limit > 1000) {
        errors.limit = "Page limit should be between 1 and 1000";
      }
      if (form.contentTypes.length === 0) {
        errors.contentTypes = "At least one content type must be selected.";
      }

      return errors;
    },
  });

  const handleContentTypeChange = (
    selectedOptions: ReadonlyArray<SelectOption>
  ) => {
    const options: SelectOption[] = selectedOptions.map((option) => {
      if (option.value === undefined) {
        throw new Error(`Option value cannot be undefined`);
      }
      return {
        label: option.label,
        value: option.value,
        description: option.description,
      };
    });
    onChange({ contentTypes: options.map((option) => option.value) });
  };

  const onSubmit = async () => {
    if (!appContext) return;
    const validationResult = validate();
    if (!validationResult) return;
    props.setSubmitting(true);
    const contentTypesToUse = data.contentTypes.filter(
      (ct): ct is string => ct !== undefined
    );
    const apiClient = new ApiClient(appContext);
    try {
      await apiClient.documents.updateRssSubscriptionCrawler(
        props.workspaceId,
        props.documentId,
        data.followLinks,
        data.limit,
        contentTypesToUse
      );

      props.setSubmitting(false);
    } catch (error) {
      console.error(Utils.getErrorMessage(error));
    }
  };
  return (
    <Form
      actions={
        <SpaceBetween size="s" direction="horizontal">
          <Button
            variant="normal"
            onClick={props.setCanceled}
            disabled={props.submitting}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={onSubmit}
            disabled={props.submitting}
          >
            Update Website Crawler Settings
          </Button>
        </SpaceBetween>
      }
    >
      <SpaceBetween size="m" direction="vertical">
        <div>
          <Box variant="h4">RSS Post Website Crawler Configuration</Box>
        </div>
        <FormField
          label="Follow Links"
          description="Follow links on websites detected from RSS feed to crawl more pages"
        >
          <Toggle
            disabled={props.submitting}
            checked={data.followLinks}
            onChange={({ detail: { checked } }) =>
              onChange({ followLinks: checked })
            }
          >
            Follow
          </Toggle>
        </FormField>
        <FormField
          label="Page Limit"
          errorText={errors.limit}
          description="Maximum number of pages to crawl for each post in the RSS Feed"
        >
          <Input
            type="number"
            disabled={!data.followLinks || props.submitting}
            value={data.limit.toString()}
            onChange={({ detail: { value } }) =>
              onChange({ limit: parseInt(value) })
            }
          />
        </FormField>
        <FormField
          label="Enabled Content Types"
          errorText={errors.contentTypes}
          description="Content Types to Enable for crawlingl"
        >
          <Multiselect
            disabled={props.submitting}
            selectedOptions={generateSelectedOptions(data.contentTypes)}
            options={multiselectOptions}
            onChange={({ detail }) =>
              handleContentTypeChange(detail.selectedOptions)
            }
          />
        </FormField>
      </SpaceBetween>
    </Form>
  );
}
