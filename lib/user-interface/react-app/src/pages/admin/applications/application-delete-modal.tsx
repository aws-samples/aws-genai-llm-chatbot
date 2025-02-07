import {
  Modal,
  Box,
  SpaceBetween,
  Button,
  Alert,
} from "@cloudscape-design/components";
import { Application } from "../../../API";

export interface ApplicationDeleteModalProps {
  visible: boolean;
  application?: Application;
  onDelete: () => void;
  onDiscard: () => void;
}

export default function ApplicationDeleteModal(
  props: ApplicationDeleteModalProps
) {
  return (
    <Modal
      visible={props.visible}
      onDismiss={props.onDiscard}
      header="Delete Application"
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
      {props.application && (
        <SpaceBetween size="m">
          <Box variant="span">
            Permanently delete application{" "}
            <Box variant="span" fontWeight="bold">
              {props.application.name}
            </Box>
            ? You can't undo this action.
          </Box>
          <Box variant="span">Application Id: {props.application.id}</Box>
          <Alert statusIconAriaLabel="Info">
            Proceeding with this action will delete the application.
          </Alert>
        </SpaceBetween>
      )}
    </Modal>
  );
}
