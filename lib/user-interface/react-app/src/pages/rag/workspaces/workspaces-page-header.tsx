import {
  Button,
  Header,
  HeaderProps,
  SpaceBetween,
} from "@cloudscape-design/components";
import RouterButton from "../../../components/wrappers/router-button";
import { ResultValue, WorkspaceItem } from "../../../common/types";
import { useNavigate } from "react-router-dom";
import { useContext, useState } from "react";
import WorkspaceDeleteModal from "../../../components/rag/workspace-delete-modal";
import { ApiClient } from "../../../common/api-client/api-client";
import { AppContext } from "../../../common/app-context";

interface WorkspacesPageHeaderProps extends HeaderProps {
  title?: string;
  createButtonText?: string;
  getWorkspaces: () => Promise<void>;
  selectedWorkspaces: readonly WorkspaceItem[];
}

export function WorkspacesPageHeader({
  title = "Workspaces",
  ...props
}: WorkspacesPageHeaderProps) {
  const navigate = useNavigate();
  const appContext = useContext(AppContext);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const isOnlyOneSelected = props.selectedWorkspaces.length === 1;
  const canDeleteWorkspace =
    props.selectedWorkspaces.length === 1 &&
    props.selectedWorkspaces[0].status == "ready";

  const onRefreshClick = async () => {
    await props.getWorkspaces();
  };

  const onViewDetailsClick = () => {
    if (props.selectedWorkspaces.length === 0) return;

    navigate(`/rag/workspaces/${props.selectedWorkspaces[0].id}`);
  };

  const onDeleteClick = () => {
    setShowDeleteModal(true);
  };

  const onDeleteWorksapce = async () => {
    if (!appContext) return;
    if (!isOnlyOneSelected) return;

    setShowDeleteModal(false);
    const apiClient = new ApiClient(appContext);
    const result = await apiClient.workspaces.deleteWorkspace(
      props.selectedWorkspaces[0].id
    );

    if (ResultValue.ok(result)) {
      setTimeout(async () => {
        await props.getWorkspaces();
      }, 1000);
    }
  };

  return (
    <>
      <WorkspaceDeleteModal
        visible={showDeleteModal}
        onDiscard={() => setShowDeleteModal(false)}
        onDelete={onDeleteWorksapce}
        workspace={props.selectedWorkspaces[0]}
      />
      <Header
        variant="awsui-h1-sticky"
        actions={
          <SpaceBetween size="xs" direction="horizontal">
            <Button iconName="refresh" onClick={onRefreshClick} />
            <RouterButton
              data-testid="header-btn-view-details"
              disabled={!isOnlyOneSelected}
              onClick={onViewDetailsClick}
            >
              View
            </RouterButton>
            <RouterButton
              data-testid="header-btn-view-details"
              disabled={!canDeleteWorkspace}
              onClick={onDeleteClick}
            >
              Delete
            </RouterButton>
            <RouterButton
              data-testid="header-btn-create"
              variant="primary"
              href="/rag/workspaces/create"
            >
              Create Workspace
            </RouterButton>
          </SpaceBetween>
        }
        {...props}
      >
        {title}
      </Header>
    </>
  );
}
