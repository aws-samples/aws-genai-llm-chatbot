import {
  BreadcrumbGroup,
  Header,
  Pagination,
  PropertyFilter,
  Table,
} from "@cloudscape-design/components";
import useOnFollow from "../../../common/hooks/use-on-follow";
import BaseAppLayout from "../../../components/base-app-layout";
import { useContext, useState, useCallback, useEffect } from "react";
import { useCollection } from "@cloudscape-design/collection-hooks";
import { ApiClient } from "../../../common/api-client/api-client";
import { AppContext } from "../../../common/app-context";
import { TextHelper } from "../../../common/helpers/text-helper";
import { PropertyFilterI18nStrings } from "../../../common/i18n/property-filter-i18n-strings";
import { ModelItem, ResultValue } from "../../../common/types";
import { TableEmptyState } from "../../../components/table-empty-state";
import { TableNoMatchState } from "../../../components/table-no-match-state";
import {
  ModelsColumnDefinitions,
  ModelsColumnFilteringProperties,
} from "./column-definitions";
import { CHATBOT_NAME } from "../../../common/constants";

export default function Models() {
  const onFollow = useOnFollow();
  const appContext = useContext(AppContext);
  const [models, setModels] = useState<ModelItem[]>([]);
  const [loading, setLoading] = useState(true);
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
    const result = await apiClient.models.getModels();
    if (ResultValue.ok(result)) {
      setModels(result.data);
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
      }
    />
  );
}
