import {
  Box,
  Button,
  FileUpload,
  Form,
  FormField,
  Modal,
  SpaceBetween,
  Spinner,
} from "@cloudscape-design/components";
import { useForm } from "../../common/hooks/use-form";

import { Storage } from "aws-amplify";
import { Dispatch, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { ChatBotConfiguration, FileStorageProvider, ImageFile } from "./types";

export interface ImageDialogProps {
  sessionId: string;
  visible: boolean;
  setVisible: (visible: boolean) => void;
  configuration: ChatBotConfiguration;
  setConfiguration: Dispatch<React.SetStateAction<ChatBotConfiguration>>;
}

const ALLOWED_MIME_TYPES = ["image/png", "image/jpg", "image/jpeg"];

export default function ImageDialog(props: ImageDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [files, setFiles] = useState<File[]>([] as File[]);

  const { data, onChange, errors, validate } = useForm({
    initialValue: () => {
      const retValue = {
        ...props.configuration,
        files: [] as File[],
      };

      return retValue;
    },
    validate: (form) => {
      const errors: Record<string, string | string[]> | null = {};
      console.log(form);
      if (!form.files || form.files.length === 0) {
        errors.files = "Please choose a file";
      }

      if (!validateFiles(form.files)) {
        errors.files = "File size or type is invalid";
      }

      return errors;
    },
  });

  const saveConfig = async () => {
    if (!validate()) return;
    setLoading(true);

    const files: ImageFile[] = (await uploadFiles(data.files)) as ImageFile[];

    props.setConfiguration({
      ...props.configuration,
      files,
    });
    setFiles([]);
    setLoading(false);
    props.setVisible(false);
  };

  const cancelChanges = () => {
    setFiles([]);
    setLoading(false);
    props.setVisible(false);
  };

  const validateFiles = (files: File[]) => {
    const maxFilesSizeMb = 10;
    setError(null);
    // ensure the first file type MIME is images png, jpg, jpeg, gif or svg and less than 5MB only
    if (files.length === 0) return false;

    const errors: string[] = [];
    files.forEach((file) => {
      if (file.size > maxFilesSizeMb * 1024 * 1024) {
        errors.push(`Files size must be less than ${maxFilesSizeMb}MB`);
      }

      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        errors.push(
          `File type must be one of ${ALLOWED_MIME_TYPES.join(", ")}`
        );
      }
    });

    if (errors.length > 0) {
      setError(errors.join(", "));
      return false;
    }

    return true;
  };

  const uploadFiles = async (files: File[]) => {
    const s3Files = [];
    for await (const file of files) {
      try {
        const response = await uploadFile(file);
        s3Files.push({
          key: `${response.key}`,
          provider: FileStorageProvider.S3,
        });
      } catch (error) {
        const errorMessage = "Error uploading file: " + error;
        console.log(errorMessage);
        setError(errorMessage);
      }
    }

    if (error) {
      return;
    }

    return s3Files;
  };

  const uploadFile = async (file: File) => {
    console.log(file);
    const id = uuidv4();
    const shortId = id.split("-")[0];
    // get the extension of the file and content type
    const extension = file.name.split(".").pop();
    const contentType = file.type;

    const response = await Storage.put(`${shortId}.${extension}`, file, {
      contentType,
    });
    return {
      ...response,
    };
  };

  return (
    <Modal
      onDismiss={() => props.setVisible(false)}
      visible={props.visible}
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs" alignItems="center">
            <Button variant="link" onClick={cancelChanges}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={loading || !files.length}
              onClick={saveConfig}
            >
              Add
            </Button>
          </SpaceBetween>
        </Box>
      }
      header="Add images to your message"
    >
      <Form>
        <SpaceBetween size="m">
          <FormField
            label="Upload from device"
            errorText={errors.files}
            description="You can upload an image to be used for this conversation."
          >
            <FileUpload
              onChange={({ detail }) => {
                onChange({ files: detail.value });
                setFiles(detail.value);
              }}
              value={files}
              i18nStrings={{
                uploadButtonText: (e) => (e ? "Choose files" : "Choose file"),
                dropzoneText: (e) =>
                  e ? "Drop files to upload" : "Drop file to upload",
                removeFileAriaLabel: (e) => `Remove file ${e + 1}`,
                limitShowFewer: "Show fewer files",
                limitShowMore: "Show more files",
                errorIconAriaLabel: "Error",
              }}
              multiple={false}
              errorText={error}
              showFileThumbnail
              tokenLimit={3}
              constraintText=".png, .jpg, .jpeg. Max 10MB."
            />
          </FormField>
          {loading && (
            <>
              <div>
                <Spinner />
                <span style={{ marginLeft: "5px" }}>Adding file...</span>
              </div>
            </>
          )}
        </SpaceBetween>
      </Form>
    </Modal>
  );
}
