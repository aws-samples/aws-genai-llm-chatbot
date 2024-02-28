import { SpaceBetween, Tabs, Textarea } from "@cloudscape-design/components";
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
  RagDocument,
} from "./types";

import { getSignedUrl } from "./utils";

import "react-json-view-lite/dist/index.css";
import "../../styles/app.scss";
import { BaseChatMessage } from "./BaseChatMessage";
import { CopyWithPopoverButton } from "./CopyButton";

export interface ChatMessageProps {
  message: ChatBotHistoryItem;
  configuration?: ChatBotConfiguration;
  showMetadata?: boolean;
  onThumbsUp: () => void;
  onThumbsDown: () => void;
}

function PromptTabs(props: { prompts: string[] | string[][] }) {
  const [promptIndex, setPromptIndex] = useState("0");
  let promptList: string[] = [];
  if (props.prompts[0][0].length > 1) {
    promptList = (props.prompts as string[][]).map((p) => p[0]);
  } else {
    promptList = props.prompts as string[];
  }
  return (
    <>
      <div className={styles.btn_chabot_metadata_copy}>
        <CopyWithPopoverButton
          onCopy={() => {
            navigator.clipboard.writeText(promptList[parseInt(promptIndex)]);
          }}
        />
      </div>
      <Tabs
        tabs={promptList.map((p, i) => {
          return {
            id: `${i}`,
            label: `Prompt ${promptList.length > 1 ? i + 1 : ""}`,
            content: <Textarea value={p} readOnly={true} rows={8} />,
          };
        })}
        activeTabId={promptIndex}
        onChange={({ detail }) => setPromptIndex(detail.activeTabId)}
      />
    </>
  );
}

export default function ChatMessage(props: ChatMessageProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const [message] = useState<ChatBotHistoryItem>(props.message);
  const [files, setFiles] = useState<ImageFile[]>([] as ImageFile[]);
  const [documentIndex, setDocumentIndex] = useState("0");

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
      <BaseChatMessage
        role={props.message?.type === ChatBotMessageType.AI ? "ai" : "human"}
        onCopy={() => {
          navigator.clipboard.writeText(props.message.content);
        }}
        waiting={props.message.content.length === 0}
        onFeedback={(thumb) => {
          thumb === "up" ? props.onThumbsUp() : props.onThumbsDown();
        }}
        expandableContent={
          props.message.type == ChatBotMessageType.AI &&
          ((props?.showMetadata && props.message.metadata) ||
            (props.message.metadata && props.configuration?.showMetadata)) ? (
            <>
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
              {props.message.metadata.documents &&
                (props.message.metadata.documents as RagDocument[]).length >
                  0 && (
                  <>
                    <div className={styles.btn_chabot_metadata_copy}>
                      <CopyWithPopoverButton
                        onCopy={() => {
                          navigator.clipboard.writeText(
                            (props.message.metadata.documents as RagDocument[])[
                              parseInt(documentIndex)
                            ].page_content
                          );
                        }}
                      />
                    </div>
                    <Tabs
                      tabs={(
                        props.message.metadata.documents as RagDocument[]
                      ).map(
                        (
                          p: {
                            metadata: { path: string };
                            page_content: string;
                          },
                          i
                        ) => {
                          return {
                            id: `${i}`,
                            label: p.metadata.path,
                            content: (
                              <Textarea
                                value={p.page_content}
                                readOnly={true}
                                rows={8}
                              />
                            ),
                          };
                        }
                      )}
                      activeTabId={documentIndex}
                      onChange={({ detail }) =>
                        setDocumentIndex(detail.activeTabId)
                      }
                    />
                  </>
                )}
              {props.message.metadata.prompts &&
                (props.message.metadata.prompts as string[]).length > 0 && (
                  <PromptTabs
                    prompts={props.message.metadata.prompts as string[]}
                  />
                )}
            </>
          ) : undefined
        }
      >
        <>
          <ReactMarkdown
            className={styles.markdown}
            remarkPlugins={[remarkGfm]}
            components={{
              pre(props) {
                const { children, ...rest } = props;
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
          >
            {props.message.content.trim()}
          </ReactMarkdown>
          {files && !loading && (
            <div style={{ marginTop: "5px" }}>
              <SpaceBetween size="s">
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
              </SpaceBetween>
            </div>
          )}
        </>
      </BaseChatMessage>
    </div>
  );
}
