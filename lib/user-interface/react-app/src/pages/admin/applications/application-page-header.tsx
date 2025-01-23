import {
  Button,
  Header,
  HeaderProps,
  SpaceBetween,
} from "@cloudscape-design/components";
import RouterButton from "../../../components/wrappers/router-button";
import { useNavigate } from "react-router-dom";
import { useContext, useState } from "react";

import { ApiClient } from "../../../common/api-client/api-client";
import { AppContext } from "../../../common/app-context";
import { Application } from "../../../API";
import { Utils } from "../../../common/utils";
import ApplicationDeleteModal from "./application-delete-modal";

interface ApplicationPageHeaderProps extends HeaderProps {
  title?: string;
  createButtonText?: string;
  getApplications: () => Promise<void>;
  selectedApplications: readonly Application[];
}

export function ApplicationPageHeader({
  title = "Applications",
  ...props
}: ApplicationPageHeaderProps) {
  const navigate = useNavigate();
  const appContext = useContext(AppContext);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const isOnlyOneSelected = props.selectedApplications.length === 1;
  const canDeleteApplication = props.selectedApplications.length === 1;

  const onRefreshClick = async () => {
    try {
      await props.getApplications();
    } catch (error) {
      console.error(Utils.getErrorMessage(error));
    }
  };

  const onViewDetailsClick = () => {
    if (props.selectedApplications.length === 0) return;

    navigate(`/admin/applications/manage/${props.selectedApplications[0].id}`);
  };

  const onDeleteClick = () => {
    setShowDeleteModal(true);
  };

  const onDeleteApplication = async () => {
    if (!appContext) return;
    if (!isOnlyOneSelected) return;

    setShowDeleteModal(false);
    const apiClient = new ApiClient(appContext);
    try {
      await apiClient.applications.deleteApplication(
        props.selectedApplications[0].id
      );

      setTimeout(async () => {
        await props.getApplications();
      }, 1500);
    } catch (error) {
      console.error(Utils.getErrorMessage(error));
    }
  };

  return (
    <>
      <ApplicationDeleteModal
        visible={showDeleteModal && canDeleteApplication}
        onDiscard={() => setShowDeleteModal(false)}
        onDelete={onDeleteApplication}
        application={props.selectedApplications[0]}
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
              Edit
            </RouterButton>
            <RouterButton
              data-testid="header-btn-view-details"
              disabled={!canDeleteApplication}
              onClick={onDeleteClick}
            >
              Delete
            </RouterButton>
            <RouterButton
              data-testid="header-btn-manage"
              variant="primary"
              href="/admin/applications/manage"
            >
              Create Application
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
