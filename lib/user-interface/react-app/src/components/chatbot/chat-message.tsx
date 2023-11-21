import {
  Box,
  Button,
  Container,
  ExpandableSection,
  Popover,
  Spinner,
  StatusIndicator,
  Tabs,
  TextContent,
  Textarea,
} from "@cloudscape-design/components";
import { useEffect, useState } from "react";
import { JsonView, darkStyles } from "react-json-view-lite";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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
              (props.message.metadata && props.showMetadata)) && (
              <ExpandableSection variant="footer" headerText="Metadata">
                <JsonView
                  shouldInitiallyExpand={(level) => level < 2}
                  data={JSON.parse(
                    JSON.stringify(props.message.metadata).replace(
                      /\\n/g,
                      "\\\\n"
                    )
                  )}
                  style={{
                    ...darkStyles,
                    stringValue: "jsonStrings",
                    numberValue: "jsonNumbers",
                    booleanValue: "jsonBool",
                    nullValue: "jsonNull",
                    container: "jsonContainer",
                  }}
                />
                {props.message.metadata.documents && (
                  <>
                    <div className={styles.btn_chabot_metadata_copy}>
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
                            navigator.clipboard.writeText(
                              "" //p["page_content"]
                            );
                          }}
                        />
                      </Popover>
                    </div>
                    <Tabs
                      tabs={(props.message.metadata.documents as string[]).map(
                        (p: any, i) => {
                          return {
                            id: `${i}`,
                            label: p.metadata.path,
                            content: (
                              <>
                                <Textarea
                                  value={p["page_content"]}
                                  readOnly={true}
                                  rows={8}
                                />
                              </>
                            ),
                          };
                        }
                      )}
                    />
                  </>
                )}
                {props.message.metadata.prompts && (
                  <>
                    <div className={styles.btn_chabot_metadata_copy}>
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
                            navigator.clipboard.writeText("");
                          }}
                        />
                      </Popover>
                    </div>
                    <Tabs
                      tabs={(props.message.metadata.prompts as string[][]).map(
                        (p, i) => {
                          return {
                            id: `${i}`,
                            label: `Prompt ${
                              (props.message.metadata.prompts as string[][])
                                .length > 1
                                ? i + 1
                                : ""
                            }`,
                            content: (
                              <>
                                <Textarea
                                  value={p[0]}
                                  readOnly={true}
                                  rows={8}
                                />
                              </>
                            ),
                          };
                        }
                      )}
                    />
                  </>
                )}
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
            remarkPlugins={[remarkGfm]}
            components={{
              pre(props) {
                const { children, className, node, ...rest } = props;
                return (
                  <pre {...rest} className={styles.codeMarkdown}>
                    {children}
                  </pre>
                );
              },
              table(props) {
                const { children, ...rest } = props;
                return (
                  <table {...rest} className={styles.markdownTable}>
                    {children}
                  </table>
                );
              },
              th(props) {
                const { children, ...rest } = props;
                return (
                  <th {...rest} className={styles.markdownTableCell}>
                    {children}
                  </th>
                );
              },
              td(props) {
                const { children, ...rest } = props;
                return (
                  <td {...rest} className={styles.markdownTableCell}>
                    {children}
                  </td>
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
