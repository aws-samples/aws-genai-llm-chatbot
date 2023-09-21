import {
  Container,
  SpaceBetween,
  ExpandableSection,
  TextContent,
  Spinner,
  Box,
} from "@cloudscape-design/components";
import {
  ChatBotConfiguration,
  ChatBotHistoryItem,
  ChatBotMessageType,
} from "./types";
import { JsonView, darkStyles } from "react-json-view-lite";
import ReactMarkdown from "react-markdown";
import { Dispatch } from "react";
import "react-json-view-lite/dist/index.css";

export interface ChatMessageProps {
  message: ChatBotHistoryItem;
  configuration: ChatBotConfiguration;
  setConfiguration: Dispatch<React.SetStateAction<ChatBotConfiguration>>;
}

export default function ChatMessage(props: ChatMessageProps) {
  return (
    <div>
      {props.message?.type === ChatBotMessageType.AI && (
        <Container
          footer={
            props.message.metadata &&
            props.configuration.showMetadata && (
              <ExpandableSection variant="footer" headerText="Metadata">
                <JsonView data={props.message.metadata} style={darkStyles} />
              </ExpandableSection>
            )
          }
        >
          <SpaceBetween size="s" direction="vertical">
            {props.message.content.length === 0 ? (
              <Box float="left">
                <Spinner />
              </Box>
            ) : null}
            <ReactMarkdown children={props.message.content} />
          </SpaceBetween>
        </Container>
      )}
      {props.message?.type === ChatBotMessageType.Human && (
        <TextContent>
          <strong>{props.message.content}</strong>
        </TextContent>
      )}
    </div>
  );
}
