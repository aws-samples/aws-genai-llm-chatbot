import {
  Alert,
  Pagination,
  PropertyFilter,
  Table,
} from "@cloudscape-design/components";
import { useCollection } from "@cloudscape-design/collection-hooks";
import { useCallback, useContext, useEffect, useState } from "react";
import { TextHelper } from "../../../common/helpers/text-helper";
import { TableEmptyState } from "../../../components/table-empty-state";
import { TableNoMatchState } from "../../../components/table-no-match-state";
import { PropertyFilterI18nStrings } from "../../../common/i18n/property-filter-i18n-strings";

import { AppContext } from "../../../common/app-context";
import { ApiClient } from "../../../common/api-client/api-client";
import { Application } from "../../../API";
import { Utils } from "../../../common/utils";
import { ApplicationPageHeader } from "./application-page-header";
import { ApplicationColumnDefinitions } from "./column-definitions";
import { ApplicationColumnFilteringProperties } from "./application-filtering-properties";

export default function ApplicationTable() {
  const appContext = useContext(AppContext);
  const [applications, setApplications] = useState<Application[]>([]);
  const [globalError, setGlobalError] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const {
    items,
    actions,
    filteredItemsCount,
    collectionProps,
    paginationProps,
    propertyFilterProps,
  } = useCollection(applications, {
    propertyFiltering: {
      filteringProperties: ApplicationColumnFilteringProperties,
      empty: (
        <TableEmptyState
          resourceName="Application Configuration"
          createHref="/admin/applications/manage"
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
        sortingColumn: ApplicationColumnDefinitions[4],
        isDescending: true,
      },
    },
    selection: {},
  });

  const getApplications = useCallback(async () => {
    if (!appContext) return;

    const apiClient = new ApiClient(appContext);
    try {
      setGlobalError(undefined);
      const result = await apiClient.applications.getApplications();
      setApplications(result.data!.listApplications);
    } catch (error) {
      console.error(Utils.getErrorMessage(error));
      setGlobalError(Utils.getErrorMessage(error));
    }

    setLoading(false);
  }, [appContext]);

  useEffect(() => {
    if (!appContext) return;

    getApplications();
  }, [appContext, getApplications]);

  return (
    <>
      {globalError && (
        <Alert
          statusIconAriaLabel="Error"
          type="error"
          header="Unable to load the applications."
        >
          {globalError}
        </Alert>
      )}
      <Table
        {...collectionProps}
        items={items}
        columnDefinitions={ApplicationColumnDefinitions}
        selectionType="single"
        variant="full-page"
        stickyHeader={true}
        resizableColumns={true}
        header={
          <ApplicationPageHeader
            selectedApplications={collectionProps.selectedItems ?? []}
            getApplications={getApplications}
            counter={
              loading
                ? undefined
                : TextHelper.getHeaderCounterText(
                    applications,
                    collectionProps.selectedItems
                  )
            }
          />
        }
        loading={loading}
        loadingText="Loading Applications"
        filter={
          <PropertyFilter
            {...propertyFilterProps}
            i18nStrings={PropertyFilterI18nStrings}
            filteringPlaceholder={"Filter Applicatioins"}
            countText={TextHelper.getTextFilterCounterText(filteredItemsCount)}
            expandToViewport={true}
          />
        }
        pagination={<Pagination {...paginationProps} />}
      />
    </>
  );
}
