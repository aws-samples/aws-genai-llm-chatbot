import {
  Box,
  Button,
  Container,
  ExpandableSection,
  Popover,
  Spinner,
  StatusIndicator,
  TextContent,
} from "@cloudscape-design/components";
import { useEffect, useState } from "react";
import { JsonView, darkStyles } from "react-json-view-lite";
import ReactMarkdown from "react-markdown";
import styles from "../../styles/chat.module.scss";
import {
  ChatBotConfiguration,
  ChatBotHistoryItem,
  ChatBotMessageType,
  ImageFile,
} from "./types";

import { getSignedUrl } from "./utils";
import "react-json-view-lite/dist/index.css";
import "../../styles/app.scss";

export interface ChatMessageProps {
  message: ChatBotHistoryItem;
  configuration?: ChatBotConfiguration;
  showMetadata?: boolean;
}

export default function ChatMessage(props: ChatMessageProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const [message] = useState<ChatBotHistoryItem>(props.message);
  const [files, setFiles] = useState<ImageFile[]>([] as ImageFile[]);

  useEffect(() => {
    const getSignedUrls = async () => {
      setLoading(true);
      if (message.metadata?.files as ImageFile[]) {
        const files: ImageFile[] = [];
        for await (const file of message.metadata?.files as ImageFile[]) {
          const signedUrl = await getSignedUrl(file.key);
          files.push({
            ...file,
            url: signedUrl as string,
          });
        }

        setLoading(false);
        setFiles(files);
      }
    };

    if (message.metadata?.files as ImageFile[]) {
      getSignedUrls();
    }
  }, [message]);

  return (
    <div>
      {props.message?.type === ChatBotMessageType.AI && (
        <Container
          footer={
            ((props.showMetadata && props.message.metadata) ||
              (props.message.metadata &&
                props.configuration?.showMetadata)) && (
              <ExpandableSection variant="footer" headerText="Metadata">
                <JsonView
                  data={props.message.metadata}
                  style={{
                    ...darkStyles,
                    stringValue: "jsonStrings",
                    numberValue: "jsonNumbers",
                    booleanValue: "jsonBool",
                    nullValue: "jsonNull",
                    container: "jsonContainer",
                  }}
                />
              </ExpandableSection>
            )
          }
        >
          {props.message.content.length === 0 ? (
            <Box>
              <Spinner />
            </Box>
          ) : null}
          {props.message.content.length > 0 ? (
            <div className={styles.btn_chabot_message_copy}>
              <Popover
                size="medium"
                position="top"
                triggerType="custom"
                dismissButton={false}
                content={
                  <StatusIndicator type="success">
                    Copied to clipboard
                  </StatusIndicator>
                }
              >
                <Button
                  variant="inline-icon"
                  iconName="copy"
                  onClick={() => {
                    navigator.clipboard.writeText(props.message.content);
                  }}
                />
              </Popover>
            </div>
          ) : null}
          <ReactMarkdown
            children={props.message.content}
            components={{
              pre(props) {
                const { children, className, node, ...rest } = props;
                return (
                  <pre
                    {...rest}
                    className={styles.codeMarkdown}
                  >
                    {children}
                  </pre>
                );
              },
            }}
          />
        </Container>
      )}
      {loading && (
        <Box float="left">
          <Spinner />
        </Box>
      )}
      {files && !loading && (
        <>
          {files.map((file, idx) => (
            <a
              key={idx}
              href={file.url as string}
              target="_blank"
              rel="noreferrer"
            >
              <img
                src={file.url as string}
                className={styles.img_chabot_message}
              />
            </a>
          ))}
        </>
      )}
      {props.message?.type === ChatBotMessageType.Human && (
        <TextContent>
          <strong>{props.message.content}</strong>
        </TextContent>
      )}
    </div>
  );
}
