import {
  BreadcrumbGroup,
  ButtonDropdown,
  Header,
  Pagination,
  PropertyFilter,
  SpaceBetween,
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
  const [selectedItems, setSelectedItems] = useState<ModelItem[]>([]);
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
          onSelectionChange={({ detail }) =>
            setSelectedItems(detail.selectedItems)
          }
          selectedItems={selectedItems}
          trackBy="name"
          selectionType="single"
          isItemDisabled={(item) => item.deployed == undefined}
          header={
            <Header
              actions={
                <SpaceBetween direction="horizontal" size="xs">
                  <ButtonDropdown
                    disabled={selectedItems.length == 0}
                    items={[
                      {
                        text: "Deploy Model",
                        id: "deploy",
                        disabled:
                          selectedItems.length > 0
                            ? selectedItems[0].deployed
                            : true,
                        disabledReason: "Selected model is already deployed.",
                      },
                      {
                        text: "Delete Model",
                        id: "delete",
                        disabled:
                          selectedItems.length > 0
                            ? !selectedItems[0].deployed
                            : true,
                        disabledReason: "Selected model is not deployed.",
                      },
                      {
                        text: "Deployment Details",
                        id: "details",
                      },
                    ]}
                  >
                    Actions
                  </ButtonDropdown>
                </SpaceBetween>
              }
              variant="awsui-h1-sticky"
              description="View the details of the variable LLM Models available for the Chatbot.
            Bedrock models are fully managed and don't require resource deployments. 
            SageMaker models are self-hosted. To deploy, stop or get details on a self-hosted model, 
            select the model from the table and chose an action from the 'Actions' dropdown."
            >
              Models
            </Header>
          }
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
