import {
  Box,
  Spinner,
  Tabs,
  Textarea,
  TextContent,
} from "@cloudscape-design/components";
import { useCallback, useContext, useEffect, useState } from "react";
import { JsonView, darkStyles } from "react-json-view-lite";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import styles from "../../styles/chat.module.scss";
import {
  ChatBotConfiguration,
  ChatBotHistoryItem,
  ChatBotMessageType,
  SessionFile,
  RagDocument,
  ChabotInputModality,
} from "./types";

import "react-json-view-lite/dist/index.css";
import "../../styles/app.scss";
import { BaseChatMessage } from "./BaseChatMessage";
import { CopyWithPopoverButton } from "./CopyButton";
import { AppContext } from "../../common/app-context";
import { ApiClient } from "../../common/api-client/api-client";
import { ChatMessageMediaDisplay } from "./chat-message-media-display";

export interface ChatMessageProps {
  message: ChatBotHistoryItem;
  configuration?: ChatBotConfiguration;
  showMetadata?: boolean;
  onThumbsUp: () => void;
  onThumbsDown: () => void;
}

function hasMediaFiles(
  images: SessionFile[],
  videos: SessionFile[],
  documents: SessionFile[]
): boolean {
  return [images, documents, videos].some(
    (mediaArray) => mediaArray?.length > 0
  );
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
  const appContext = useContext(AppContext);
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<ChatBotHistoryItem>(props.message);
  const [documents, setDocuments] = useState<SessionFile[]>(
    [] as SessionFile[]
  );
  const [images, setImages] = useState<SessionFile[]>([] as SessionFile[]);
  const [videos, setVideos] = useState<SessionFile[]>([] as SessionFile[]);
  const [documentIndex, setDocumentIndex] = useState("0");
  const [processingAsyncFiles, setProcessingAsyncFiles] =
    useState<boolean>(false);
  const [asyncFiles, setAsyncFiles] = useState<SessionFile[]>([]);
  const [processedKeys, setProcessedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    setMessage(props.message);
  }, [props.message]);

  const isAIResponseLoading = useCallback(() => {
    if (message.type !== ChatBotMessageType.AI) {
      return false;
    }
    const { images, videos, documents } = props.message.metadata as Record<
      string,
      SessionFile[]
    >;
    const hasAttachments = hasMediaFiles(images, videos, documents);
    return hasAttachments ? loading : props.message.content?.length === 0;
  }, [props.message.metadata, props.message.content, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const getSignedUrl = useCallback(
    async (apiClient: ApiClient, file: SessionFile): Promise<string | null> => {
      try {
        const response = await apiClient.sessions.getFileSignedUrl(file.key);
        console.log(`File ${file.key} retrieved: ${response.data?.getFileURL}`);
        return response.data?.getFileURL || null;
      } catch (error) {
        console.log(
          `File ${file.key} could not be retrieved ${JSON.stringify(error)}`
        );
        return null;
      }
    },
    []
  );

  const processPendingFiles = useCallback(
    async (apiClient: ApiClient, pendingFiles: SessionFile[]) => {
      const retryDelay = 30000;
      const maxRetries = 12;
      let retryCount = 0;
      let remainingFiles = pendingFiles.filter(
        (file) => !processedKeys.has(file.key)
      );

      if (remainingFiles.length === 0) return;

      setProcessingAsyncFiles(true);
      setAsyncFiles(remainingFiles);

      try {
        while (remainingFiles.length > 0 && retryCount < maxRetries) {
          const stillPending: SessionFile[] = [];
          const newlyReady: SessionFile[] = [];

          await Promise.all(
            remainingFiles.map(async (file) => {
              if (processedKeys.has(file.key)) return;

              const signedUrl = await getSignedUrl(apiClient, file);
              if (signedUrl) {
                newlyReady.push({ ...file, url: signedUrl });
                setProcessedKeys((prev) => new Set([...prev, file.key]));
              } else {
                stillPending.push(file);
              }
            })
          );

          if (newlyReady.length > 0) {
            setVideos((prev) => {
              const existingKeys = new Set(prev.map((f) => f.key));
              const uniqueNewFiles = newlyReady.filter(
                (f) =>
                  !existingKeys.has(f.key) &&
                  f.type === ChabotInputModality.Video
              );
              return [...prev, ...uniqueNewFiles];
            });
          }

          remainingFiles = stillPending;
          setAsyncFiles(remainingFiles);

          if (remainingFiles.length > 0) {
            await new Promise((resolve) => setTimeout(resolve, retryDelay));
            retryCount++;
          }
        }
      } finally {
        setProcessingAsyncFiles(false);
        setAsyncFiles([]);
      }

      if (remainingFiles.length > 0) {
        console.warn("Some files could not be processed:", remainingFiles);
      }
    },
    [getSignedUrl, processedKeys]
  );

  useEffect(() => {
    const processFiles = async () => {
      const sessionFiles: SessionFile[] = [
        ...((message.metadata.images || []) as SessionFile[]),
        ...((message.metadata.videos || []) as SessionFile[]),
        ...((message.metadata.documents || []) as SessionFile[]),
      ];

      if (!appContext || sessionFiles.length === 0) return;

      const apiClient = new ApiClient(appContext);
      setLoading(true);

      try {
        const pendingFiles: SessionFile[] = [];
        const immediateFiles: SessionFile[] = [];
        await Promise.all(
          (sessionFiles as SessionFile[]).map(async (file: SessionFile) => {
            if (processedKeys.has(file.key)) return;

            const signedUrl = await getSignedUrl(apiClient, file);
            if (signedUrl) {
              immediateFiles.push({ ...file, url: signedUrl });
              setProcessedKeys((prev) => new Set([...prev, file.key]));
            } else if (file.type === ChabotInputModality.Video) {
              // Video files to be processed asynchronously
              pendingFiles.push(file);
            }
          })
        );

        setImages((prev: SessionFile[]) => {
          const existingKeys = new Set(prev.map((f) => f.key));
          const uniqueImages = immediateFiles.filter(
            (f) =>
              f.type === ChabotInputModality.Image && !existingKeys.has(f.key)
          );
          return [...prev, ...uniqueImages];
        });

        setDocuments((prev: SessionFile[]) => {
          const existingKeys = new Set(prev.map((f) => f.key));
          const uniqueDocuments = immediateFiles.filter(
            (f) =>
              f.type === ChabotInputModality.Document &&
              !existingKeys.has(f.key)
          );
          return [...prev, ...uniqueDocuments];
        });

        setVideos((prev: SessionFile[]) => {
          const existingKeys = new Set(prev.map((f) => f.key));
          const uniqueVideos = immediateFiles.filter(
            (f) =>
              f.type === ChabotInputModality.Video && !existingKeys.has(f.key)
          );
          return [...prev, ...uniqueVideos];
        });

        if (pendingFiles.length > 0) {
          processPendingFiles(apiClient, pendingFiles);
        }
      } catch (error) {
        console.error("Error processing files:", error);
      } finally {
        setLoading(false);
      }
    };
    processFiles();
  }, [
    appContext,
    message,
    props.message.metadata,
    processPendingFiles,
    getSignedUrl,
    processedKeys,
  ]);

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
    <div style={{ marginTop: message.type == "ai" ? "0" : "0.5em" }}>
      <BaseChatMessage
        data-locator="chatbot-ai-container"
        role={props.message?.type === ChatBotMessageType.AI ? "ai" : "human"}
        onCopy={() => {
          navigator.clipboard.writeText(props.message.content);
        }}
        waiting={isAIResponseLoading()}
        onFeedback={(thumb) => {
          thumb && thumb === "up" ? props.onThumbsUp() : props.onThumbsDown();
        }}
        name={
          props.message?.type === ChatBotMessageType.Human ? "" : "Assistant"
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
          {!loading && hasMediaFiles(images, documents, videos) && (
            <ChatMessageMediaDisplay
              images={images}
              documents={documents}
              videos={videos}
              isAIMessage={
                props.message?.type === ChatBotMessageType.AI ? true : false
              }
            />
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
          {processingAsyncFiles && (
            <Box>
              <TextContent>
                <small>
                  {asyncFiles.map((file) => file.type).join(" and ")}{" "}
                  {asyncFiles.length > 1 ? "are" : "is"} being generated. This
                  might take few minutes. You can keep using the app and come
                  back later.
                </small>
              </TextContent>
              <Spinner />
            </Box>
          )}
        </>
      </BaseChatMessage>
    </div>
  );
}
