import { useContext, useEffect, useState } from "react";
import {
  ChatBotConfiguration,
  ChatBotHistoryItem,
  ChatBotMessageType,
  FeedbackData,
} from "./types";
import {
  Alert,
  SpaceBetween,
  StatusIndicator,
} from "@cloudscape-design/components";
import { v4 as uuidv4 } from "uuid";
import { AppContext } from "../../common/app-context";
import { ApiClient } from "../../common/api-client/api-client";
import ChatMessage from "./chat-message";
import ChatInputPanel, { ChatScrollState } from "./chat-input-panel";
import styles from "../../styles/chat.module.scss";
import { CHATBOT_NAME } from "../../common/constants";
import { Application } from "../../API";

export default function Chat(props: {
  sessionId?: string;
  applicationId?: string;
}) {
  const appContext = useContext(AppContext);
  const [running, setRunning] = useState<boolean>(false);
  const [session, setSession] = useState<
    { id: string; loading: boolean } | undefined
  >();
  const [application, setApplication] = useState<Application>(
    {} as Application
  );
  const [initError, setInitError] = useState<string | undefined>(undefined);
  const [configuration, setConfiguration] = useState<ChatBotConfiguration>(
    () => ({
      streaming: true,
      showMetadata: false,
      maxTokens: 512,
      temperature: 0.6,
      topP: 0.9,
      images: null,
      documents: null,
      videos: null,
      seed: 0,
      filesBlob: {
        images: null,
        documents: null,
        videos: null,
      },
    })
  );

  const [messageHistory, setMessageHistory] = useState<ChatBotHistoryItem[]>(
    []
  );

  useEffect(() => {
    if (!appContext) return;
    setMessageHistory([]);

    (async () => {
      if (!props.sessionId) {
        setSession({ id: uuidv4(), loading: false });
        return;
      }

      setSession({ id: props.sessionId, loading: true });
      const apiClient = new ApiClient(appContext);
      try {
        const result = await apiClient.sessions.getSession(props.sessionId);

        if (result.data?.getSession?.history) {
          ChatScrollState.skipNextHistoryUpdate = true;
          ChatScrollState.skipNextScrollEvent = true;
          setMessageHistory(
            result
              .data!.getSession!.history.filter((x) => x !== null)
              .map((x) => ({
                type: x!.type as ChatBotMessageType,
                metadata: JSON.parse(x!.metadata!),
                content: x!.content,
              }))
          );

          window.scrollTo({
            top: 0,
            behavior: "instant",
          });
        }
      } catch (error) {
        console.log(error);
      }

      setSession({ id: props.sessionId, loading: false });
      setRunning(false);
    })();
  }, [appContext, props.sessionId]);

  const handleFeedback = (
    feedbackType: 1 | 0,
    idx: number,
    message: ChatBotHistoryItem
  ) => {
    if (message.metadata.sessionId) {
      let prompt = "";
      if (Array.isArray(message.metadata.prompts)) {
        prompt = (message.metadata?.prompts[0] as string) || "";
      }
      const completion = message.content;
      const model = message.metadata.modelId;
      const feedbackData: FeedbackData = {
        sessionId: message.metadata.sessionId as string,
        key: idx,
        feedback: feedbackType,
        prompt: prompt,
        completion: completion,
        model: model as string,
        applicationId: props.applicationId,
      };
      addUserFeedback(feedbackData);
    }
  };

  const addUserFeedback = async (feedbackData: FeedbackData) => {
    if (!appContext) return;

    const apiClient = new ApiClient(appContext);
    await apiClient.userFeedback.addUserFeedback({ feedbackData });
  };

  return (
    <div
      className={
        props.applicationId ? styles.chat_app_container : styles.chat_container
      }
    >
      {initError && (
        <Alert
          statusIconAriaLabel="Error"
          type="error"
          header="Unable to initalize the Chatbot."
        >
          {initError}
        </Alert>
      )}
      <SpaceBetween direction="vertical" size="xxs">
        {messageHistory.map((message, idx) => {
          return (
            <ChatMessage
              key={idx}
              message={message}
              showMetadata={configuration.showMetadata}
              onThumbsUp={() => handleFeedback(1, idx, message)}
              onThumbsDown={() => handleFeedback(0, idx, message)}
            />
          );
        })}
      </SpaceBetween>
      <div className={styles.welcome_text}>
        {messageHistory.length == 0 &&
          !session?.loading &&
          !props.applicationId && <center>{CHATBOT_NAME}</center>}
        {messageHistory.length == 0 &&
          !session?.loading &&
          props.applicationId && (
            <center>{application.name ?? CHATBOT_NAME}</center>
          )}
        {session?.loading && (
          <center>
            <StatusIndicator type="loading">Loading session</StatusIndicator>
          </center>
        )}
      </div>
      <div className={styles.input_container}>
        {session && (
          <ChatInputPanel
            session={session}
            running={running}
            setRunning={setRunning}
            messageHistory={messageHistory}
            setMessageHistory={(history) => setMessageHistory(history)}
            setInitErrorMessage={(error) => setInitError(error)}
            configuration={configuration}
            setConfiguration={setConfiguration}
            applicationId={props.applicationId}
            setApplication={setApplication}
          />
        )}
      </div>
    </div>
  );
}
