import {
  Pagination,
  PropertyFilter,
  Table,
} from "@cloudscape-design/components";
import { useCollection } from "@cloudscape-design/collection-hooks";
import { useCallback, useContext, useEffect, useState } from "react";
import { ResultValue, WorkspaceItem } from "../../../common/types";
import { TextHelper } from "../../../common/helpers/text-helper";
import { TableEmptyState } from "../../../components/table-empty-state";
import { TableNoMatchState } from "../../../components/table-no-match-state";
import { ChatbotsPageHeader } from "./chatbots-page-header";
import { PropertyFilterI18nStrings } from "../../../common/i18n/property-filter-i18n-strings";
import {
  ChatbotsColumnDefinitions,
  ChatbotsColumnFilteringProperties,
} from "./column-definitions";
import { AppContext } from "../../../common/app-context";
import { ApiClient } from "../../../common/api-client/api-client";

export default function ChatsTable() {
  const appContext = useContext(AppContext);
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const {
    items,
    actions,
    filteredItemsCount,
    collectionProps,
    paginationProps,
    propertyFilterProps,
  } = useCollection(workspaces, {
    propertyFiltering: {
      filteringProperties: ChatbotsColumnFilteringProperties,
      empty: (
        <TableEmptyState
          resourceName="Chatbot"
          createHref="/chatbot/chatbots/create"
        />
      ),
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
        sortingColumn: ChatbotsColumnDefinitions[4],
        isDescending: true,
      },
    },
    selection: {},
  });

  const getWorkspaces = useCallback(async () => {
    if (!appContext) return;

    const apiClient = new ApiClient(appContext);
    const result = await apiClient.workspaces.getWorkspaces();
    if (ResultValue.ok(result)) {
      setWorkspaces(result.data);
    }

    setLoading(false);
  }, [appContext]);

  useEffect(() => {
    if (!appContext) return;

    getWorkspaces();
  }, [appContext, getWorkspaces]);

  return (
    <Table
      {...collectionProps}
      items={items}
      columnDefinitions={ChatbotsColumnDefinitions}
      selectionType="single"
      variant="full-page"
      stickyHeader={true}
      resizableColumns={true}
      header={
        <ChatbotsPageHeader
          selectedWorkspaces={collectionProps.selectedItems ?? []}
          getWorkspaces={getWorkspaces}
          counter={
            loading
              ? undefined
              : TextHelper.getHeaderCounterText(
                  workspaces,
                  collectionProps.selectedItems
                )
          }
        />
      }
      loading={loading}
      loadingText="Loading Chatbots"
      filter={
        <PropertyFilter
          {...propertyFilterProps}
          i18nStrings={PropertyFilterI18nStrings}
          filteringPlaceholder={"Filter Chatbots"}
          countText={TextHelper.getTextFilterCounterText(filteredItemsCount)}
          expandToViewport={true}
        />
      }
      pagination={<Pagination {...paginationProps} />}
    />
  );
}
