import {
  Alert,
  Box,
  Button,
  Form,
  FormField,
  Input,
  Modal,
  SpaceBetween,
  Toggle,
} from "@cloudscape-design/components";
import { useForm } from "../../common/hooks/use-form";
import { ChabotOutputModality, ChatBotConfiguration } from "./types";
import { ChatSession } from "./multi-chat";
import { useEffect, useState } from "react";

export interface LLMConfigDialogProps {
  session: ChatSession;
  //visible: boolean;
  setVisible: (visible: boolean) => void;
  onConfigurationChange: (config: ChatBotConfiguration) => void;
}

interface LLMConfigDialogData {
  streaming: boolean;
  showMetadata: boolean;
  maxTokens: number;
  temperature: number;
  topP: number;
  seed: number;
}

export default function LLMConfigDialog(props: LLMConfigDialogProps) {
  const [outputModality, setOutputModality] = useState<ChabotOutputModality>();
  const { data, onChange, errors, validate } = useForm<LLMConfigDialogData>({
    initialValue: () => {
      const retValue = {
        streaming: props.session.configuration.streaming,
        showMetadata: props.session.configuration.showMetadata,
        maxTokens: props.session.configuration.maxTokens,
        temperature: props.session.configuration.temperature,
        topP: props.session.configuration.topP,
        seed: props.session.configuration.seed,
      };

      return retValue;
    },
    validate: (form) => {
      const errors: Record<string, string | string[]> = {};

      if (form.temperature < 0 || form.temperature > 1.0) {
        errors.temperature = "Temperature must be between 0 and 1.0";
      }

      return errors;
    },
  });

  useEffect(() => {
    const metadata = props.session.modelMetadata;

    if ((metadata?.outputModalities?.length || 0) > 0) {
      setOutputModality(metadata!.outputModalities[0] as ChabotOutputModality);
    }
  }, [props.session]);

  const saveConfig = () => {
    if (!validate()) return;

    props.onConfigurationChange({
      ...props.session.configuration,
      ...data,
    });

    props.setVisible(false);
  };

  const cancelChanges = () => {
    props.setVisible(false);
  };

  return (
    <Modal
      onDismiss={() => props.setVisible(false)}
      visible={true}
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs" alignItems="center">
            <Button variant="link" onClick={cancelChanges}>
              Cancel
            </Button>
            <Button variant="primary" onClick={saveConfig}>
              Save changes
            </Button>
          </SpaceBetween>
        </Box>
      }
      header="Configuration"
    >
      <Form>
        <SpaceBetween size="m">
          <FormField label="Session Id">{props.session.id}</FormField>
          <FormField label="Streaming" errorText={errors.streaming}>
            <Toggle
              checked={data.streaming}
              onChange={({ detail: { checked } }) =>
                onChange({ streaming: checked })
              }
            >
              Enabled (if supported by the model)
            </Toggle>
          </FormField>
          <FormField label="Metadata" errorText={errors.showMetadata}>
            <Toggle
              checked={data.showMetadata}
              onChange={({ detail: { checked } }) =>
                onChange({ showMetadata: checked })
              }
            >
              Show metadata
            </Toggle>
          </FormField>
          {!outputModality && (
            <Alert>Select a model to view extra configurations</Alert>
          )}
          {outputModality === ChabotOutputModality.Text && (
            <>
              <FormField
                label="Max Tokens"
                errorText={errors.maxTokens}
                description="This is the maximum number of tokens that the LLM generates. The higher the number, the longer the response. This is strictly related to the target model."
              >
                <Input
                  type="number"
                  step={1}
                  value={data.maxTokens.toString()}
                  onChange={({ detail: { value } }) => {
                    onChange({ maxTokens: parseInt(value) });
                  }}
                />
              </FormField>
              <FormField
                label="Temperature"
                errorText={errors.temperature}
                description="A higher temperature setting usually results in a more varied and inventive output, but it may also raise the chances of deviating from the topic."
              >
                <Input
                  type="number"
                  step={0.05}
                  value={data.temperature.toFixed(2)}
                  onChange={({ detail: { value } }) => {
                    let floatVal = parseFloat(value);
                    floatVal = Math.min(1.0, Math.max(0.0, floatVal));

                    onChange({ temperature: floatVal });
                  }}
                />
              </FormField>
              <FormField
                label="Top-P"
                errorText={errors.topP}
                description="Top-P picks from the top tokens based on the sum of their probabilities. Also known as nucleus sampling, is another hyperparameter that controls the randomness of language model output. This method can produce more diverse and interesting output than traditional methods that randomly sample the entire vocabulary."
              >
                <Input
                  type="number"
                  step={0.1}
                  value={data.topP.toFixed(2)}
                  onChange={({ detail: { value } }) => {
                    let floatVal = parseFloat(value);
                    floatVal = Math.min(1.0, Math.max(0.0, floatVal));

                    onChange({ topP: floatVal });
                  }}
                />
              </FormField>
            </>
          )}
          {outputModality &&
            [ChabotOutputModality.Image, ChabotOutputModality.Video].includes(
              outputModality
            ) && (
              <FormField
                label="Seed"
                errorText={errors.seed}
                description="For video and image generation, a seed value can be used to generate the same output multiple times. Using a different seed value guarantees to get different generations."
              >
                <Input
                  type="number"
                  step={1}
                  value={data.seed.toString()}
                  onChange={({ detail: { value } }) => {
                    onChange({ seed: parseInt(value) });
                  }}
                />
              </FormField>
            )}
        </SpaceBetween>
      </Form>
    </Modal>
  );
}
