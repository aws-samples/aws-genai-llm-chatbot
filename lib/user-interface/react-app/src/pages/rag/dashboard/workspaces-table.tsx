import {
  Box,
  Header,
  SpaceBetween,
  Table,
  TableProps,
} from "@cloudscape-design/components";
import { useState, useContext } from "react";
import { UserRole } from "../../../common/types";
import { UserContext } from "../../../common/user-context";
import { TextHelper } from "../../../common/helpers/text-helper";
import { WorkspacesColumnDefinitions } from "./column-definitions";
import RouterLink from "../../../components/wrappers/router-link";
import RouterButton from "../../../components/wrappers/router-button";
import { Workspace } from "../../../API";

export interface WorkspacesTableProps {
  loading: boolean;
  workspaces: Workspace[];
}

export default function WorkspacesTable(props: WorkspacesTableProps) {
  const userContext = useContext(UserContext);
  const [selectedItems, setSelectedItems] = useState<Workspace[]>([]);
  const isOnlyOneSelected = selectedItems.length === 1;

  return (
    <Table
      loading={props.loading}
      loadingText="Loading Workspaces"
      selectionType="single"
      sortingDisabled={true}
      empty={
        <Box margin={{ vertical: "xs" }} textAlign="center" color="inherit">
          <SpaceBetween size="xxs">
            <div>
              <b>No Workspaces</b>
              <Box variant="p" color="inherit">
                Workspace is a collection of documents
              </Box>
            </div>
            {[UserRole.ADMIN, UserRole.WORKSPACES_MANAGER].includes(
              userContext.userRole
            ) ? (
              <RouterButton href="/rag/workspaces/create">
                Create Workspace
              </RouterButton>
            ) : null}
          </SpaceBetween>
        </Box>
      }
      columnDefinitions={WorkspacesColumnDefinitions}
      items={props.workspaces.slice(0, 5)}
      selectedItems={selectedItems}
      onSelectionChange={(event: {
        detail: TableProps.SelectionChangeDetail<Workspace>;
      }) => setSelectedItems(event.detail.selectedItems)}
      header={
        <Header
          counter={
            !props.loading
              ? TextHelper.getHeaderCounterText(props.workspaces, selectedItems)
              : undefined
          }
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <RouterButton
                disabled={!isOnlyOneSelected}
                href={`/rag/workspaces/${
                  selectedItems.length > 0 ? selectedItems[0].id : ""
                }`}
              >
                View
              </RouterButton>
              {[UserRole.ADMIN, UserRole.WORKSPACES_MANAGER].includes(
                userContext.userRole
              ) ? (
                <RouterButton href="/rag/workspaces/create">
                  Create Workspace
                </RouterButton>
              ) : null}
            </SpaceBetween>
          }
        >
          Workspaces
        </Header>
      }
      footer={
        <Box textAlign="center">
          <RouterLink href="/rag/workspaces">View all Workspaces</RouterLink>
        </Box>
      }
    />
  );
}
