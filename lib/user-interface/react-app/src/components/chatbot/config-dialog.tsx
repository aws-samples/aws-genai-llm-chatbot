import {
  Box,
  Button,
  Form,
  FormField,
  Input,
  Modal,
  SpaceBetween,
  Toggle,
  Textarea
} from "@cloudscape-design/components";
import { useForm } from "../../common/hooks/use-form";
import { ChatBotConfiguration } from "./types";
import { Dispatch } from "react";
import {
  PROMPT_DESC,
  RAG_PROMPT_DESC,
  RAG_SQ_PROMPT_DESC,
  PROMPT_TEMPLATE, 
  RAG_PROMPT_TEMPLATE, 
  RAG_SQ_PROMPT_TEMPLATE,
} from "./constants"

export interface ConfigDialogProps {
  sessionId: string;
  visible: boolean;
  setVisible: (visible: boolean) => void;
  configuration: ChatBotConfiguration;
  setConfiguration: Dispatch<React.SetStateAction<ChatBotConfiguration>>;
}

interface ChatConfigDialogData {
  streaming: boolean;
  showMetadata: boolean;
  maxTokens: number;
  temperature: number;
  topP: number;
  promptTemplate: string;
  ragPromptTemplate: string;
  ragSqPromptTemplate: string;
}

export default function ConfigDialog(props: ConfigDialogProps) {
  const { data, onChange, errors, validate } = useForm<ChatConfigDialogData>({
    initialValue: () => {
      const retValue = {
        streaming: props.configuration.streaming,
        showMetadata: props.configuration.showMetadata,
        maxTokens: props.configuration.maxTokens,
        temperature: props.configuration.temperature,
        topP: props.configuration.topP,
        promptTemplate: props.configuration.promptTemplate,
        ragPromptTemplate: props.configuration.ragPromptTemplate,
        ragSqPromptTemplate: props.configuration.ragSqPromptTemplate,
      };

      return retValue;
    },
    validate: (form) => {
      console.log("errors")

      const errors: Record<string, string | string[]> = {};

      if (form.temperature < 0 || form.temperature > 1.0) {
        errors.temperature = "Temperature must be between 0 and 1.0";
      }
    
      const requiredPromptPlaceholders =  ['input', 'chat_history'];

      for (const requiredPlaceholder of requiredPromptPlaceholders) {
          const formattedPlaceholder = `{${requiredPlaceholder}}`;
          let start = 0;
          let found = false;
          let counter = 0;
          while (start < form.promptTemplate.length && counter < 1) {
              start = form.promptTemplate.indexOf(formattedPlaceholder, start);
              if (start === -1 && found) {
                  break;
              } else if (start === -1) {
                  errors.promptTemplate = `The Prompt Template does not contain the required placeholder: ${formattedPlaceholder}. \n`;
                  break;
              } 
              else {
                  found = true;
                  start += formattedPlaceholder.length;
              }
              counter += 1;
          }
      }

      const requiredRAGPromptPlaceholders =  ['question', 'context'];

      for (const requiredPlaceholder of requiredRAGPromptPlaceholders) {
          const formattedPlaceholder = `{${requiredPlaceholder}}`;
          let start = 0;
          let found = false;
          let counter = 0;
          while (start < form.ragPromptTemplate.length && counter < 1) {
              start = form.ragPromptTemplate.indexOf(formattedPlaceholder, start);
              if (start === -1 && found) {
                  break;
              } else if (start === -1) {
                  errors.ragPromptTemplate = `The RAG Prompt Template does not contain the required placeholder: ${formattedPlaceholder}. \n`;
                  break;
              } 
              else {
                  found = true;
                  start += formattedPlaceholder.length;
              }
              counter += 1;
          }
      }

      const requiredRAGSQPromptPlaceholders =  ['question', 'chat_history'];

      for (const requiredPlaceholder of requiredRAGSQPromptPlaceholders) {
          const formattedPlaceholder = `{${requiredPlaceholder}}`;
          let start = 0;
          let found = false;
          let counter = 0;
          while (start < form.ragSqPromptTemplate.length && counter < 1) {
              start = form.ragSqPromptTemplate.indexOf(formattedPlaceholder, start);
              if (start === -1 && found) {
                  break;
              } else if (start === -1) {
                  errors.ragSqPromptTemplate = `The RAG Standalone Prompt Template does not contain the required placeholder: ${formattedPlaceholder}. \n`;
                  break;
              } 
              else {
                  found = true;
                  start += formattedPlaceholder.length;
              }
              counter += 1;
          }
      }

      return errors;
    },
  });

  const saveConfig = () => {
    if (!validate()) return;

    props.setConfiguration({
      ...props.configuration,
      ...data,
    });

    props.setVisible(false);
  };

  const cancelChanges = () => {
    onChange({
      ...props.configuration,
      streaming: props.configuration.streaming,
      showMetadata: props.configuration.showMetadata,
      temperature: props.configuration.temperature,
      maxTokens: props.configuration.maxTokens,
      topP: props.configuration.topP,
      promptTemplate: props.configuration.promptTemplate,
      ragPromptTemplate: props.configuration.ragPromptTemplate,
      ragSqPromptTemplate: props.configuration.ragSqPromptTemplate,
    });

    props.setVisible(false);
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
          <FormField label="Session Id">{props.sessionId}</FormField>
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
              value={data.temperature.toString()}
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
              value={data.topP.toString()}
              onChange={({ detail: { value } }) => {
                let floatVal = parseFloat(value);
                floatVal = Math.min(1.0, Math.max(0.0, floatVal));

                onChange({ topP: floatVal });
              }}
            />
          </FormField>
          <FormField
            label="Prompt Template"
            errorText={errors.promptTemplate}
            description={PROMPT_DESC}
          >
            <Textarea
                data-testid="prompt-template-textarea"
                placeholder={PROMPT_TEMPLATE}
                value={data.promptTemplate.trim()}
                rows={7}
                onChange={({ detail: { value } }) => {
                  onChange({ promptTemplate: value.trim() });
                }}
            />
          </FormField>
          <FormField
            label="RAG Prompt Template (Only Claude)"
            errorText={errors.ragPromptTemplate}
            description={RAG_PROMPT_DESC}
          >
            <Textarea
                data-testid="prompt-template-textarea"
                placeholder={RAG_PROMPT_TEMPLATE}
                value={data.ragPromptTemplate.trim()}
                rows={7}
                onChange={({ detail: { value } }) => {
                  onChange({ ragPromptTemplate: value.trim() });
                }}
            />
          </FormField>
          <FormField
            label="RAG Standalone Question Prompt Template (Only Claude)"
            errorText={errors.ragSqPromptTemplate}
            description={RAG_SQ_PROMPT_DESC}
          >
            <Textarea
                data-testid="prompt-template-textarea"
                placeholder={RAG_SQ_PROMPT_TEMPLATE}
                value={data.ragSqPromptTemplate.trim()}
                rows={7}
                onChange={({ detail: { value } }) => {
                  onChange({ ragSqPromptTemplate: value.trim() });
                }}
            />
          </FormField>
        </SpaceBetween>
      </Form>
    </Modal>
  );
}
