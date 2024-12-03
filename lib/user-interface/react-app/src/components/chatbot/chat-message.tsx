import {
  Box,
  Container,
  Spinner,
  TextContent,
} from "@cloudscape-design/components";
import { useContext, useEffect, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import styles from "../../styles/chat.module.scss";
import {
  ChatBotConfiguration,
  ChatBotHistoryItem,
  ChatBotMessageType,
  MediaFile,
  ChabotOutputModality,
} from "./types";
import { AppContext } from "../../common/app-context";
import { ApiClient } from "../../common/api-client/api-client";
import { ChatMessageMetadata } from "./chat-message-metadata";
import { ChatMessageMediaDisplay } from "./chat-message-media-display";
import { ChatMessageFeedbackButtons } from "./chat-message-feedback-buttons";

export interface ChatMessageProps {
  message: ChatBotHistoryItem;
  configuration?: ChatBotConfiguration;
  showMetadata?: boolean;
  onThumbsUp: () => void;
  onThumbsDown: () => void;
}

export default function ChatMessage(props: ChatMessageProps) {
  const appContext = useContext(AppContext);
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<ChatBotHistoryItem>(props.message);
  const [files, setFiles] = useState<MediaFile[]>([] as MediaFile[]);
  const [documentIndex, setDocumentIndex] = useState("0");
  const [promptIndex, setPromptIndex] = useState("0");
  const [selectedIcon, setSelectedIcon] = useState<1 | 0 | null>(null);
  const [processingAsyncFiles, setProcessingAsyncFiles] =
    useState<boolean>(false);
  const [asyncFiles, setAsyncFiles] = useState<MediaFile[]>([]);
  const [processedKeys, setProcessedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    setMessage(props.message);
  }, [props.message]);

  const getSignedUrl = useCallback(
    async (apiClient: ApiClient, file: MediaFile): Promise<string | null> => {
      try {
        const response = await apiClient.sessions.getFileSignedUrl(file.key);
        console.log(`File ${file.key} retrieved: ${response.data?.getFileURL}`);
        return response.data?.getFileURL || null;
      } catch (error) {
        console.log(`File ${file.key} could not be retrieved ${error}`);
        return null;
      }
    },
    []
  );

  const processPendingFiles = useCallback(
    async (apiClient: ApiClient, pendingFiles: MediaFile[]) => {
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
          const stillPending: MediaFile[] = [];
          const newlyReady: MediaFile[] = [];

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
            setFiles((prev) => {
              const existingKeys = new Set(prev.map((f) => f.key));
              const uniqueNewFiles = newlyReady.filter(
                (f) => !existingKeys.has(f.key)
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
      if (!appContext || !message.metadata?.files) return;
      const files = message.metadata.files as MediaFile[];
      if (files.length === 0) return;

      const apiClient = new ApiClient(appContext);
      setLoading(true);

      try {
        const pendingFiles: MediaFile[] = [];
        const immediateFiles: MediaFile[] = [];

        await Promise.all(
          (message.metadata.files as MediaFile[]).map(
            async (file: MediaFile) => {
              if (processedKeys.has(file.key)) return;

              const signedUrl = await getSignedUrl(apiClient, file);
              if (signedUrl) {
                immediateFiles.push({ ...file, url: signedUrl });
                setProcessedKeys((prev) => new Set([...prev, file.key]));
              } else if (file.type === ChabotOutputModality.Video) {
                pendingFiles.push(file);
              }
            }
          )
        );

        setFiles((prev) => {
          const existingKeys = new Set(prev.map((f) => f.key));
          const uniqueNewFiles = immediateFiles.filter(
            (f) => !existingKeys.has(f.key)
          );
          return [...prev, ...uniqueNewFiles];
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
  }, [appContext, message, processPendingFiles, getSignedUrl, processedKeys]);

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
      {props.message?.type === ChatBotMessageType.AI && (
        <Container
          data-locator="chatbot-ai-container"
          footer={
            ((props?.showMetadata && props.message.metadata) ||
              (props.message.metadata &&
                props.configuration?.showMetadata)) && (
              <ChatMessageMetadata
                metadata={props.message.metadata}
                showMetadata={true}
                documentIndex={documentIndex}
                promptIndex={promptIndex}
                setDocumentIndex={setDocumentIndex}
                setPromptIndex={setPromptIndex}
              />
            )
          }
        >
          {loading ||
          (content.length === 0 && !processingAsyncFiles && !files.length) ? (
            <Box>
              <Spinner />
            </Box>
          ) : (
            <>
              {content && (
                <ReactMarkdown
                  children={content}
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
                />
              )}

              <ChatMessageMediaDisplay files={files} isAIMessage={true} />

              {processingAsyncFiles && (
                <Box margin={{ top: "s" }}>
                  <TextContent>
                    <small>
                      {asyncFiles.map((file) => file.type).join(" and ")}{" "}
                      {asyncFiles.length > 1 ? "are" : "is"} being generated.
                      This might take few minutes. You can keep using the app
                      and come back later.
                    </small>
                  </TextContent>
                  <Spinner />
                </Box>
              )}

              <ChatMessageFeedbackButtons
                selectedIcon={selectedIcon}
                onThumbsUp={props.onThumbsUp}
                onThumbsDown={props.onThumbsDown}
                setSelectedIcon={setSelectedIcon}
              />
            </>
          )}
        </Container>
      )}

      {props.message?.type === ChatBotMessageType.Human && (
        <>
          {(!processingAsyncFiles || files.length > 0) && (
            <TextContent>
              <strong>{props.message.content}</strong>
            </TextContent>
          )}
          <ChatMessageMediaDisplay files={files} isAIMessage={false} />
        </>
      )}
    </div>
  );
}
