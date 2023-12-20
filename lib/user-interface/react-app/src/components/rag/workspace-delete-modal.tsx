import {
  Modal,
  Box,
  SpaceBetween,
  Button,
  Alert,
} from "@cloudscape-design/components";
import { Workspace } from "../../API";

export interface WorkspaceDeleteModalProps {
  visible: boolean;
  workspace?: Workspace;
  onDelete: () => void;
  onDiscard: () => void;
}

export default function WorkspaceDeleteModal(props: WorkspaceDeleteModalProps) {
  return (
    <Modal
      visible={props.visible}
      onDismiss={props.onDiscard}
      header="Delete Workspace"
      closeAriaLabel="Close dialog"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={props.onDiscard}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={props.onDelete}
              data-testid="submit"
            >
              Delete
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      {props.workspace && (
        <SpaceBetween size="m">
          <Box variant="span">
            Permanently delete workspace{" "}
            <Box variant="span" fontWeight="bold">
              {props.workspace.name}
            </Box>
            ? You can't undo this action.
          </Box>
          <Box variant="span">Worksapce Id: {props.workspace.id}</Box>
          <Alert statusIconAriaLabel="Info">
            Proceeding with this action will delete the workspace with all its
            content.
          </Alert>
        </SpaceBetween>
      )}
    </Modal>
  );
}
