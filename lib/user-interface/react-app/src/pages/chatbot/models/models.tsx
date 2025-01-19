import {
  BreadcrumbGroup,
  Header,
  HelpPanel,
  Pagination,
  PropertyFilter,
  Table,
  Link,
  Alert,
} from "@cloudscape-design/components";
import useOnFollow from "../../../common/hooks/use-on-follow";
import BaseAppLayout from "../../../components/base-app-layout";
import { useContext, useState, useCallback, useEffect } from "react";
import { useCollection } from "@cloudscape-design/collection-hooks";
import { ApiClient } from "../../../common/api-client/api-client";
import { AppContext } from "../../../common/app-context";
import { TextHelper } from "../../../common/helpers/text-helper";
import { PropertyFilterI18nStrings } from "../../../common/i18n/property-filter-i18n-strings";
import { TableEmptyState } from "../../../components/table-empty-state";
import { TableNoMatchState } from "../../../components/table-no-match-state";
import { ModelsColumnDefinitions } from "./column-definitions";
import { CHATBOT_NAME } from "../../../common/constants";
import { Model } from "../../../API";
import { Utils } from "../../../common/utils";
import { ModelsColumnFilteringProperties } from "./model-filtering-properties";

export default function Models() {
  const onFollow = useOnFollow();
  const appContext = useContext(AppContext);
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalError, setGlobalError] = useState<string | undefined>(undefined);
  const {
    items,
    actions,
    filteredItemsCount,
    collectionProps,
    paginationProps,
    propertyFilterProps,
  } = useCollection(models, {
    propertyFiltering: {
      filteringProperties: ModelsColumnFilteringProperties,
      empty: <TableEmptyState resourceName="model" />,
      noMatch: (
        <TableNoMatchState
          onClearFilter={() => {
            actions.setPropertyFiltering({ tokens: [], operation: "and" });
          }}
        />
      ),
    },
    pagination: { pageSize: 50 },
    sorting: {
      defaultState: {
        sortingColumn: ModelsColumnDefinitions[0],
        isDescending: false,
      },
    },
    selection: {},
  });

  const getModels = useCallback(async () => {
    if (!appContext) return;

    const apiClient = new ApiClient(appContext);
    try {
      setGlobalError(undefined);
      const result = await apiClient.models.getModels();

      setModels(result.data!.listModels);
    } catch (error) {
      console.error(Utils.getErrorMessage(error));
      setGlobalError(Utils.getErrorMessage(error));
    }
    setLoading(false);
  }, [appContext]);

  useEffect(() => {
    if (!appContext) return;

    getModels();
  }, [appContext, getModels]);

  return (
    <BaseAppLayout
      contentType="table"
      breadcrumbs={
        <BreadcrumbGroup
          onFollow={onFollow}
          items={[
            {
              text: CHATBOT_NAME,
              href: "/",
            },
            {
              text: "Models",
              href: "/chatbot/models",
            },
          ]}
        />
      }
      content={
        <>
          {globalError && (
            <Alert
              statusIconAriaLabel="Error"
              type="error"
              header="Unable to load the models."
            >
              {globalError}
            </Alert>
          )}
          <Table
            {...collectionProps}
            items={items}
            columnDefinitions={ModelsColumnDefinitions}
            variant="full-page"
            stickyHeader={true}
            resizableColumns={true}
            header={<Header variant="awsui-h1-sticky">Models</Header>}
            loading={loading}
            loadingText="Loading Models"
            filter={
              <PropertyFilter
                {...propertyFilterProps}
                i18nStrings={PropertyFilterI18nStrings}
                filteringPlaceholder={"Filter Models"}
                countText={TextHelper.getTextFilterCounterText(
                  filteredItemsCount
                )}
                expandToViewport={true}
              />
            }
            pagination={<Pagination {...paginationProps} />}
          />
        </>
      }
      info={
        <HelpPanel header={<Header variant="h3">Foundation Models</Header>}>
          <p>
            For Amazon Bedrock we display all models available in the selected
            AWS Region.
          </p>
          <p>
            You might need to request access to the models you want to use via
            the Amazon Bedrock{" "}
            <Link
              external
              href="https://console.aws.amazon.com/bedrock/home?#/modelaccess"
            >
              Model access
            </Link>{" "}
            page
          </p>
        </HelpPanel>
      }
    />
  );
}
