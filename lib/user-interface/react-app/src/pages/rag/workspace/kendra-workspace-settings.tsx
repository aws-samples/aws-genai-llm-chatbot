import {
  ColumnLayout,
  SpaceBetween,
  Box,
  StatusIndicator,
  Form,
  Button,
  Container,
  Header,
  Flashbar,
} from "@cloudscape-design/components";
import { Labels } from "../../../common/constants";
import { ResultValue, WorkspaceItem } from "../../../common/types";
import { useContext, useState } from "react";
import { AppContext } from "../../../common/app-context";
import { ApiClient } from "../../../common/api-client/api-client";
import { Utils } from "../../../common/utils";

export interface KendraWorkspaceSettingsProps {
  workspace: WorkspaceItem;
}

export default function KendraWorkspaceSettings(
  props: KendraWorkspaceSettingsProps
) {
  const appContext = useContext(AppContext);
  const [syncing, setSyncing] = useState(false);
  const [showSyncSuccessMessage, setShowSyncSuccessMessage] = useState(false);
  const [globalError, setGlobalError] = useState("");

  const onStartKendraDataSync = async () => {
    if (!appContext) return;

    setSyncing(true);
    setShowSyncSuccessMessage(false);
    setGlobalError("");

    const apiClient = new ApiClient(appContext);
    const result = await apiClient.ragEngines.startKendraDataSync(
      props.workspace.id
    );

    if (ResultValue.ok(result)) {
      setShowSyncSuccessMessage(true);
    } else {
      setGlobalError(Utils.getErrorMessage(result));
    }

    setSyncing(false);
  };

  return (
    <Form
      actions={
        !props.workspace.kendraIndexExternal ? (
          <SpaceBetween direction="horizontal" size="xs">
            <Button
              data-testid="create"
              variant="primary"
              disabled={syncing}
              onClick={onStartKendraDataSync}
            >
              Start Kendra Data Sync
            </Button>
          </SpaceBetween>
        ) : undefined
      }
      errorText={globalError}
    >
      <SpaceBetween size="l">
        <Container
          header={<Header variant="h2">Kendra Workspace Settings</Header>}
        >
          <ColumnLayout columns={2} variant="text-grid">
            <SpaceBetween size="l">
              <div>
                <Box variant="awsui-key-label">Workspace Id</Box>
                <div>{props.workspace.id}</div>
              </div>
              <div>
                <Box variant="awsui-key-label">Workspace Name</Box>
                <div>{props.workspace.name}</div>
              </div>
              <div>
                <Box variant="awsui-key-label">Status</Box>
                <div>
                  <StatusIndicator
                    type={Labels.statusTypeMap[props.workspace.status]}
                  >
                    {Labels.statusMap[props.workspace.status]}
                  </StatusIndicator>
                </div>
              </div>
            </SpaceBetween>
            <SpaceBetween size="l">
              <div>
                <Box variant="awsui-key-label">Engine</Box>
                <div>{Labels.engineMap[props.workspace.engine]}</div>
              </div>
              {typeof props.workspace.kendraIndexId !== "undefined" && (
                <div>
                  <Box variant="awsui-key-label">Kendra Index Id</Box>
                  <div>{props.workspace.kendraIndexId}</div>
                </div>
              )}
              {typeof props.workspace.kendraIndexExternal !== "undefined" && (
                <div>
                  <Box variant="awsui-key-label">External</Box>
                  <div>
                    {props.workspace.kendraIndexExternal === true
                      ? "Yes"
                      : "No"}
                  </div>
                </div>
              )}
            </SpaceBetween>
          </ColumnLayout>
        </Container>
        {showSyncSuccessMessage && (
          <Flashbar
            items={[
              {
                type: "success",
                dismissible: true,
                content: <>Sync has been started. It can take some time.</>,
                onDismiss: () => setShowSyncSuccessMessage(false),
              },
            ]}
          />
        )}
      </SpaceBetween>
    </Form>
  );
}
