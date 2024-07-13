import {
  Modal,
  Box,
  SpaceBetween,
  Button,
  Alert,
} from "@cloudscape-design/components";
import { Document } from "../../API";

export interface DocumentDeleteModalProps {
  visible: boolean;
  document?: Document;
  onDelete: () => void;
  onDiscard: () => void;
}

export default function DocumentDeleteModal(props: DocumentDeleteModalProps) {
  return (
    <Modal
      visible={props.visible}
      onDismiss={props.onDiscard}
      header="Delete Document"
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
      {props.document && (
        <SpaceBetween size="m">
          <Box variant="span">
            Permanently delete document{" "}
            <Box variant="span" fontWeight="bold">
              {props.document.title}
            </Box>
            ? You can't undo this action.
          </Box>
          <Box variant="span">Document Id: {props.document.id}</Box>
          <Alert statusIconAriaLabel="Info">
            Proceeding with this action will delete the document with all its
            content.
          </Alert>
        </SpaceBetween>
      )}
    </Modal>
  );
}
