import {
  BreadcrumbGroup,
  Button,
  Container,
  ContentLayout,
  Form,
  FormField,
  Header,
  Select,
  SelectProps,
  SpaceBetween,
  StatusIndicator,
  Tabs,
  TabsProps,
  Textarea,
} from "@cloudscape-design/components";
import useOnFollow from "../../../common/hooks/use-on-follow";
import BaseAppLayout from "../../../components/base-app-layout";
import { useContext, useEffect, useState } from "react";
import { useForm } from "../../../common/hooks/use-form";
import { AppContext } from "../../../common/app-context";
import {
  LoadingStatus,
  ResultValue,
  SemanticSearchResult,
  WorkspaceItem,
} from "../../../common/types";
import { OptionsHelper } from "../../../common/helpers/options-helper";
import { ApiClient } from "../../../common/api-client/api-client";
import { useSearchParams } from "react-router-dom";
import { Utils } from "../../../common/utils";
import SemanticSearchDetails from "./semantic-search-details";
import ResultItems from "./result-items";
import { CHATBOT_NAME } from "../../../common/constants";

interface SemanticSearchData {
  workspace: SelectProps.Option | null;
  query: string;
}

export default function SemanticSearch() {
  const onFollow = useOnFollow();
  const appContext = useContext(AppContext);
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchResult, setSearchResult] = useState<SemanticSearchResult | null>(
    null
  );
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [detailsExpanded, setDetailsExpanded] = useState<boolean>(false);
  const [globalError, setGlobalError] = useState<string | undefined>(undefined);
  const [workspacesLoadingStatus, setWorkspacesLoadingStatus] =
    useState<LoadingStatus>("loading");
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const { data, onChange, errors, validate } = useForm<SemanticSearchData>({
    initialValue: () => {
      return {
        workspace: null,
        query: "",
      };
    },
    validate: (form) => {
      const errors: Record<string, string | string[]> = {};

      if (form.query.length === 0 || form.query.length > 1000) {
        errors.query = "Query must be between 1 and 1000 characters";
      }

      if (!form.workspace) {
        errors.workspace = "Workspace is required";
      }

      return errors;
    },
  });

  const onSearch = async () => {
    if (!validate()) return;
    if (!appContext) return;
    if (!data.workspace?.value) return;

    setGlobalError(undefined);
    setSubmitting(true);
    setSearchResult(null);

    const apiClient = new ApiClient(appContext);
    const result = await apiClient.semanticSearch.query(
      data.workspace?.value,
      data.query
    );

    if (ResultValue.ok(result)) {
      setSearchResult(result.data);
    } else {
      setGlobalError(Utils.getErrorMessage(result));
    }

    setSubmitting(false);
  };

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
        setGlobalError(Utils.getErrorMessage(result));
      }
    })();
  }, [appContext, onChange, searchParams]);

  const workspaceOptions = OptionsHelper.getSelectOptions(workspaces || []);
  if (Utils.isDevelopment()) {
    console.log("re-render");
  }

  const tabs: TabsProps.Tab[] = [];

  if (searchResult) {
    tabs.push({
      label: "Results",
      id: "results",
      content: <ResultItems items={searchResult.items} result={searchResult} />,
    });

    if (searchResult.vectorSearchItems?.length > 0) {
      tabs.push({
        label: "Vector Search",
        id: "vector-search",
        content: (
          <ResultItems
            items={searchResult.vectorSearchItems}
            result={searchResult}
          />
        ),
      });
    }

    if (searchResult.keywordSearchItems?.length > 0) {
      tabs.push({
        label: "Keyword Search",
        id: "keyword-search",
        content: (
          <ResultItems
            items={searchResult.keywordSearchItems}
            result={searchResult}
          />
        ),
      });
    }
  }

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
              href: "/rag/workspaces/",
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
              text: "Semantic Search",
              href: "/rag/semantic-search",
            },
          ]}
        />
      }
      content={
        <ContentLayout header={<Header variant="h1">Semantic Search</Header>}>
          <SpaceBetween size="l">
            <Form
              actions={
                <SpaceBetween
                  direction="horizontal"
                  size="l"
                  alignItems="center"
                >
                  {submitting && (
                    <StatusIndicator type="loading">Loading</StatusIndicator>
                  )}
                  <Button variant="primary" onClick={onSearch}>
                    Search
                  </Button>
                </SpaceBetween>
              }
              errorText={globalError}
            >
              <SpaceBetween size="l">
                <Container
                  footer={
                    searchResult && (
                      <SemanticSearchDetails
                        searchResults={searchResult}
                        detailsExpanded={detailsExpanded}
                        setDetailsExpanded={setDetailsExpanded}
                      />
                    )
                  }
                >
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
                    <FormField label="Search Query" errorText={errors.query}>
                      <Textarea
                        value={data.query}
                        onChange={({ detail: { value } }) =>
                          onChange({ query: value })
                        }
                      />
                    </FormField>
                  </SpaceBetween>
                </Container>
              </SpaceBetween>
            </Form>
            {searchResult && (
              <>
                {searchResult.items.length === 0 && (
                  <Container>
                    <Header variant="h3">No results found</Header>
                  </Container>
                )}
                {searchResult.items.length > 0 && <Tabs tabs={tabs} />}
              </>
            )}
          </SpaceBetween>
        </ContentLayout>
      }
    />
  );
}
