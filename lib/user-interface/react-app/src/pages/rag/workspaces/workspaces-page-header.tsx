import {
  Button,
  Header,
  HeaderProps,
  SpaceBetween,
} from "@cloudscape-design/components";
import RouterButton from "../../../components/wrappers/router-button";
import { WorkspaceItem } from "../../../common/types";
import { useNavigate } from "react-router-dom";

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
  const isOnlyOneSelected = props.selectedWorkspaces.length === 1;

  const onRefreshClick = async () => {
    await props.getWorkspaces();
  };

  const onViewDetailsClick = () => {
    if (props.selectedWorkspaces.length === 0) return;

    navigate(`/rag/workspaces/${props.selectedWorkspaces[0].id}`);
  };

  return (
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
  );
}
