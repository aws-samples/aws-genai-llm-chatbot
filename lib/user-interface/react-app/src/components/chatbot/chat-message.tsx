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
import "react-json-view-lite/dist/index.css";

export interface ChatMessageProps {
  message: ChatBotHistoryItem;
  configuration: ChatBotConfiguration;
  showMetadata?: boolean;
}

export default function ChatMessage(props: ChatMessageProps) {
  return (
    <div>
      {props.message?.type === ChatBotMessageType.AI && (
        <Container
          footer={
            ((props.showMetadata && props.message.metadata) ||
              (props.message.metadata && props.configuration.showMetadata)) && (
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
            <ReactMarkdown
              children={props.message.content}
              components={{
                pre(props) {
                  const { children, className, node, ...rest } = props;
                  return (
                    <pre
                      {...rest}
                      className={className}
                      style={{
                        overflow: "scroll",
                        backgroundColor: "rgb(240,240,240)",
                        color: "black",
                        borderRadius: "5px",
                        padding: "5px",
                      }}
                    >
                      {children}
                    </pre>
                  );
                },
              }}
            />
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
