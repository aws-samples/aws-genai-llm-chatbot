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
import { AgentTrace } from "./chat";
import { Trace } from "./trace";

export interface ChatMessageProps {
  message: ChatBotHistoryItem;
  configuration?: ChatBotConfiguration;
  showMetadata?: boolean;
  onThumbsUp: () => void;
  onThumbsDown: () => void;
  agentTrace?: AgentTrace;
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

  let content = "";
  if (props.message.content && props.message.content.length > 0) {
    // Message is final
    content = props.message.content;
  } else if (props.message.tokens && props.message.tokens.length > 0) {
    // Streaming in progess. Hides the tokens out of sequence
    // If I have 1,2,4, it would only display 1,2.
    let currentSequence: number | undefined = undefined;
    for (const token of props.message.tokens) {
      if (
        currentSequence === undefined ||
        currentSequence + 1 == token.sequenceNumber
      ) {
        currentSequence = token.sequenceNumber;
        content += token.value;
      }
    }
  }

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
        name={
          props.message?.type === ChatBotMessageType.Human
            ? "Human"
            : "Assistant"
        }
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
                      ).map((p: RagDocument, i) => {
                        return {
                          id: `${i}`,
                          label:
                            p.metadata.path?.split("/").at(-1) ??
                            p.metadata.title ??
                            p.metadata.document_id.slice(-8),
                          content: (
                            <Textarea
                              value={p.page_content}
                              readOnly={true}
                              rows={8}
                            />
                          ),
                        };
                      })}
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
          {props.message?.type == ChatBotMessageType.AI &&
            props.agentTrace &&
            props.message?.content.length === 0 && (
              <Trace agentTrace={props.agentTrace} />
            )}
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
            {content?.trim()}
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
