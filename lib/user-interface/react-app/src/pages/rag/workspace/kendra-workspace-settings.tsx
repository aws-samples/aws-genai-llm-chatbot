import {
  ColumnLayout,
  SpaceBetween,
  Box,
  StatusIndicator,
} from "@cloudscape-design/components";
import { Labels } from "../../../common/constants";
import { WorkspaceItem } from "../../../common/types";

export interface KendraWorkspaceSettingsProps {
  workspace: WorkspaceItem;
}

export default function KendraWorkspaceSettings(
  props: KendraWorkspaceSettingsProps
) {
  return (
    <ColumnLayout columns={1} variant="text-grid">
      <SpaceBetween size="l">
        <div>
          <Box variant="awsui-key-label">Workspace Id</Box>
          <div>{props.workspace.id}</div>
        </div>
        <div>
          <Box variant="awsui-key-label">Engine</Box>
          <div>{Labels.engineMap[props.workspace.engine]}</div>
        </div>
        <div>
          <Box variant="awsui-key-label">Name</Box>
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
    </ColumnLayout>
  );
}
