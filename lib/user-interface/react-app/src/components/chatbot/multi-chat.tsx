import {
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  SelectProps,
  SpaceBetween,
  Button,
  Select,
  ColumnLayout,
  Toggle,
  StatusIndicator,
  Container,
} from "@cloudscape-design/components";
import { v4 as uuidv4 } from "uuid";
import { AppContext } from "../../common/app-context";
import { ApiClient } from "../../common/api-client/api-client";
import ChatMessage from "./chat-message";
import MultiChatInputPanel, { ChatScrollState } from "./multi-chat-input-panel";
import { ReadyState } from "react-use-websocket";
import { OptionsHelper } from "../../common/helpers/options-helper";
import { API } from "aws-amplify";
import { GraphQLSubscription, GraphQLResult } from "@aws-amplify/api";
import { Model, ReceiveMessagesSubscription, Workspace } from "../../API";
import {
  ChatBotConfiguration,
  ChatBotAction,
  ChatBotHistoryItem,
  ChatBotMessageResponse,
  ChatBotMessageType,
  ChatBotRunRequest,
  ChatBotMode,
  ChabotInputModality,
  ChabotOutputModality,
  ChatBotHeartbeatRequest,
  ChatBotModelInterface,
  FeedbackData,
} from "./types";
import { LoadingStatus, ModelInterface } from "../../common/types";
import { getSelectedModelMetadata, updateMessageHistoryRef } from "./utils";
import LLMConfigDialog from "./llm-config-dialog";
import styles from "../../styles/chat.module.scss";
import { useNavigate } from "react-router-dom";
import { receiveMessages } from "../../graphql/subscriptions";
import { sendQuery } from "../../graphql/mutations.ts";
import { Utils } from "../../common/utils";

export interface ChatSession {
  configuration: ChatBotConfiguration;
  model?: SelectProps.Option;
  modelMetadata?: Model;
  workspace?: SelectProps.Option;
  id: string;
  loading: boolean;
  running: boolean;
  messageHistory: ChatBotHistoryItem[];
  subscription?: ZenObservable.Subscription;
}

function createNewSession(): ChatSession {
  return {
    id: uuidv4(),
    loading: false,
    running: false,
    messageHistory: [],
    configuration: {
      files: [],
      streaming: true,
      showMetadata: false,
      maxTokens: 512,
      temperature: 0.1,
      topP: 0.9,
    },
  };
}

const workspaceDefaultOptions: SelectProps.Option[] = [
  {
    label: "No workspace (RAG data source)",
    value: "",
    iconName: "close",
  },
  {
    label: "Create new workspace",
    value: "__create__",
    iconName: "add-plus",
  },
];

export default function MultiChat() {
  const navigate = useNavigate();
  const appContext = useContext(AppContext);
  const refChatSessions = useRef<ChatSession[]>([]);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [modelsStatus, setModelsStatus] = useState<LoadingStatus>("loading");
  const [workspacesStatus, setWorkspacesStatus] =
    useState<LoadingStatus>("loading");
  const [enableAddModels, setEnableAddModels] = useState(true);
  const [llmToConfig, setLlmToConfig] = useState<ChatSession | undefined>(
    undefined
  );
  const [showMetadata, setShowMetadata] = useState(false);
  const [readyState, setReadyState] = useState<ReadyState>(
    ReadyState.UNINSTANTIATED
  );

  useEffect(() => {
    if (!appContext) return;
    setReadyState(ReadyState.OPEN);
    addSession();
    addSession();
    setEnableAddModels(true);

    (async () => {
      const apiClient = new ApiClient(appContext);
      let workspaces: Workspace[] = [];
      let modelsResult: GraphQLResult<any>;
      let workspacesResult: GraphQLResult<any>;
      try {
        if (appContext?.config.rag_enabled) {
          [modelsResult, workspacesResult] = await Promise.all([
            apiClient.models.getModels(),
            apiClient.workspaces.getWorkspaces(),
          ]);
          workspaces = workspacesResult.data?.listWorkspaces;
          setWorkspacesStatus(
            workspacesResult.errors === undefined ? "finished" : "error"
          );
        } else {
          modelsResult = await apiClient.models.getModels();
        }

        const models = modelsResult.data
          ? modelsResult.data.listModels.filter(
              (m: any) =>
                m.inputModalities.includes(ChabotInputModality.Text) &&
                m.outputModalities.includes(ChabotOutputModality.Text)
            )
          : [];
        setModels(models);
        setWorkspaces(workspaces);
        setModelsStatus("finished");
      } catch (error) {
        console.error(Utils.getErrorMessage(error));
        setModelsStatus("error");
      }
    })();

    return () => {
      refChatSessions.current.forEach((session) => {
        console.log(`Unsubscribing from ${session.id}`);
        session.subscription?.unsubscribe();
      });
      refChatSessions.current = [];
    };
  }, [appContext]);

  const enabled =
    readyState === ReadyState.OPEN &&
    chatSessions.length > 0 &&
    !chatSessions.some((c) => c.running) &&
    !chatSessions.some((c) => c.loading) &&
    !chatSessions.some((c) => !c.model);

  const handleSendMessage = (message: string): void => {
    if (!enabled) return;
    // send message to each chat session
    setEnableAddModels(false);
    chatSessions.forEach((chatSession) => {
      if (chatSession.running) return;
      if (readyState !== ReadyState.OPEN) return;
      ChatScrollState.userHasScrolled = false;

      const { name, provider } = OptionsHelper.parseValue(
        chatSession.model?.value
      );

      const value = message.trim();
      const request: ChatBotRunRequest = {
        action: ChatBotAction.Run,
        modelInterface: chatSession.modelMetadata!.interface as ModelInterface,
        data: {
          modelName: name,
          provider: provider,
          sessionId: chatSession.id,
          files: [],
          workspaceId: chatSession.workspace?.value,
          modelKwargs: {
            streaming: chatSession.configuration.streaming,
            maxTokens: chatSession.configuration.maxTokens,
            temperature: chatSession.configuration.temperature,
            topP: chatSession.configuration.topP,
          },
          text: value,
          mode: ChatBotMode.Chain,
        },
      };

      chatSession.running = true;
      chatSession.messageHistory = [
        ...chatSession.messageHistory,
        {
          type: ChatBotMessageType.Human,
          content: value,
          metadata: {},
        },
        {
          type: ChatBotMessageType.AI,
          content: "",
          metadata: {},
        },
      ];

      setChatSessions([...chatSessions]);
      const result = API.graphql({
        query: sendQuery,
        variables: {
          data: JSON.stringify(request),
        },
      });
      console.log(result);
    });
  };

  function subscribe(sessionId: string): ZenObservable.Subscription {
    console.log("Subscribing to AppSync");
    const sub = API.graphql<GraphQLSubscription<ReceiveMessagesSubscription>>({
      query: receiveMessages,
      variables: {
        sessionId: sessionId,
      },
      authMode: "AMAZON_COGNITO_USER_POOLS",
    }).subscribe({
      next: ({ value }) => {
        const data = value.data!.receiveMessages?.data;
        if (data !== undefined && data !== null) {
          const response: ChatBotMessageResponse = JSON.parse(data);
          console.log(JSON.stringify(response));
          if (response.action === ChatBotAction.Heartbeat) {
            console.log("Heartbeat pong!");
            return;
          }

          const sessionId = response.data.sessionId;
          const session = refChatSessions.current.filter(
            (c) => c.id === sessionId
          )[0];
          if (session !== undefined) {
            updateMessageHistoryRef(
              session.id,
              session.messageHistory,
              response
            );
            if ((response.action = ChatBotAction.FinalResponse)) {
              session.running = false;
            }
            setChatSessions([...refChatSessions.current]);
          }
        }
      },
      error: (error) => console.warn(error),
    });
    return sub;
  }

  function addSession() {
    if (refChatSessions.current.length >= 4) {
      return;
    }

    const session = createNewSession();
    const sub = subscribe(session.id);

    console.log(`Subscribed to session ${session.id}}`);
    const request: ChatBotHeartbeatRequest = {
      action: ChatBotAction.Heartbeat,
      modelInterface: ChatBotModelInterface.Langchain,
      data: {
        sessionId: session.id,
      },
    };
    API.graphql({
      query: sendQuery,
      variables: {
        data: JSON.stringify(request),
      },
    });
    session.subscription = sub;
    refChatSessions.current.push(session);
    console.log(
      "Sessions",
      refChatSessions.current.map((s) => s.id)
    );
    setChatSessions([...refChatSessions.current]);
  }

  useLayoutEffect(() => {
    if (ChatScrollState.skipNextHistoryUpdate) {
      ChatScrollState.skipNextHistoryUpdate = false;
      return;
    }

    const count = Math.max(...chatSessions.map((s) => s.messageHistory.length));

    if (!ChatScrollState.userHasScrolled && count > 0) {
      ChatScrollState.skipNextScrollEvent = true;
      window.scrollTo({
        top: document.documentElement.scrollHeight + 1000,
        behavior: "instant",
      });
    }
  }, [chatSessions]);

  const messages = transformMessages(chatSessions);
  const workspaceOptions = [
    ...workspaceDefaultOptions,
    ...OptionsHelper.getSelectOptions(workspaces || []),
  ];

  const connectionStatus = {
    [ReadyState.CONNECTING]: "Connecting",
    [ReadyState.OPEN]: "Open",
    [ReadyState.CLOSING]: "Closing",
    [ReadyState.CLOSED]: "Closed",
    [ReadyState.UNINSTANTIATED]: "Uninstantiated",
  }[readyState];

  const handleFeedback = (feedbackType: 1 | 0, idx: number, message: ChatBotHistoryItem, messageHistory: ChatBotHistoryItem[]) => {
    console.log("Message history: ", messageHistory);
    if (message.metadata.sessionId) {
      const prompt = messageHistory[idx - 1]?.content;
      const completion = message.content;
      const model = message.metadata.modelId;
      const feedbackData: FeedbackData = {
        sessionId: message.metadata.sessionId as string,
        key: idx,
        feedback: feedbackType,
        prompt: prompt,
        completion: completion,
        model: model as string
      };
      addUserFeedback(feedbackData);
    }
  };

  const addUserFeedback = async (feedbackData: FeedbackData) => {
    if (!appContext) return;

    const apiClient = new ApiClient(appContext);
    await apiClient.userFeedback.addUserFeedback({feedbackData});
  };

  return (
    <div className={styles.chat_container}>
      <SpaceBetween size="m">
        <SpaceBetween size="m" alignItems="end">
          <SpaceBetween size="m" direction="horizontal" alignItems="center">
            <StatusIndicator
              type={
                readyState === ReadyState.OPEN
                  ? "success"
                  : readyState === ReadyState.CONNECTING ||
                    readyState === ReadyState.UNINSTANTIATED
                  ? "in-progress"
                  : "error"
              }
            >
              {readyState === ReadyState.OPEN ? "Connected" : connectionStatus}
            </StatusIndicator>
            <Toggle
              checked={showMetadata ?? false}
              onChange={({ detail }) => setShowMetadata(detail.checked)}
            >
              Show Metadata
            </Toggle>
            <Button
              onClick={() => addSession()}
              disabled={!enableAddModels || chatSessions.length >= 4}
              iconName="add-plus"
            >
              Add model
            </Button>
            <Button
              onClick={() => {
                refChatSessions.current.forEach((s) => {
                  s.subscription?.unsubscribe();
                  s.messageHistory = [];
                  s.id = uuidv4();
                  s.subscription = subscribe(s.id);
                });
                setEnableAddModels(true);
                setChatSessions([...refChatSessions.current]);
              }}
              iconName="remove"
            >
              Clear messages
            </Button>
          </SpaceBetween>
        </SpaceBetween>
        <ColumnLayout columns={chatSessions.length}>
          {chatSessions.map((chatSession) => (
            <Container key={chatSession.id}>
              <SpaceBetween direction="vertical" size="m">
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr min-content",
                    gap: "8px",
                  }}
                >
                  <Select
                    disabled={!enableAddModels}
                    loadingText="Loading models (might take few seconds)..."
                    statusType={modelsStatus}
                    placeholder="Select a model"
                    empty={
                      <div>
                        No models available. Please make sure you have access to
                        Amazon Bedrock or alternatively deploy a self hosted
                        model on SageMaker or add API_KEY to Secrets Manager
                      </div>
                    }
                    filteringType="auto"
                    selectedOption={chatSession.model ?? null}
                    onChange={({ detail }) => {
                      chatSession.model = detail.selectedOption;
                      chatSession.modelMetadata =
                        getSelectedModelMetadata(
                          models,
                          detail.selectedOption
                        ) ?? undefined;
                      setChatSessions([...chatSessions]);
                    }}
                    options={OptionsHelper.getSelectOptionGroups(models)}
                  />
                  <div style={{ display: "flex", gap: "2px" }}>
                    <Button
                      iconName="settings"
                      variant="icon"
                      onClick={() => setLlmToConfig(chatSession)}
                    />
                    <Button
                      iconName="remove"
                      variant="icon"
                      disabled={chatSessions.length <= 2 || messages.length > 0}
                      onClick={() => {
                        refChatSessions.current
                          .filter((c) => c.id == chatSession.id)[0]
                          .subscription?.unsubscribe();
                        console.log(`Unsubscribe from ${chatSession.id}`);
                        refChatSessions.current =
                          refChatSessions.current.filter(
                            (c) => c.id !== chatSession.id
                          );
                        setChatSessions([...refChatSessions.current]);
                      }}
                    />
                  </div>
                </div>
                {llmToConfig && (
                  <LLMConfigDialog
                    session={llmToConfig}
                    setVisible={() => setLlmToConfig(undefined)}
                    onConfigurationChange={(configuration) => {
                      llmToConfig.configuration = configuration;
                      setChatSessions([...chatSessions]);
                    }}
                  />
                )}
                {appContext?.config.rag_enabled && true && (
                  <Select
                    disabled={!enableAddModels}
                    loadingText="Loading workspaces (might take few seconds)..."
                    statusType={workspacesStatus}
                    placeholder="Select a workspace (RAG data source)"
                    filteringType="auto"
                    selectedOption={
                      chatSession.workspace ?? workspaceDefaultOptions[0]
                    }
                    options={workspaceOptions}
                    onChange={({ detail }) => {
                      if (detail.selectedOption?.value === "__create__") {
                        navigate("/rag/workspaces/create");
                      } else {
                        chatSession.workspace = detail.selectedOption;
                        setChatSessions([...chatSessions]);
                      }
                    }}
                    empty={"No Workspaces available"}
                  />
                )}
              </SpaceBetween>
            </Container>
          ))}
        </ColumnLayout>
        {messages.map((val, idx) => {
          if (val.length === 0) {
            return null;
          }

          return (
            <ColumnLayout columns={chatSessions.length} key={idx}>
              {val.map((message, idx) => (
                <ChatMessage
                  key={idx}
                  message={message}
                  showMetadata={showMetadata}
                  onThumbsUp={() => handleFeedback(1, idx, message, val)}
                  onThumbsDown={() => handleFeedback(0, idx, message, val)}
                />
              ))}
            </ColumnLayout>
          );
        })}
      </SpaceBetween>
      <div className={styles.input_container}>
        <MultiChatInputPanel
          running={chatSessions.some((c) => c.running)}
          enabled={enabled}
          onSendMessage={handleSendMessage}
        />
      </div>
    </div>
  );
}

function transformMessages(sessions: ChatSession[]) {
  const count = Math.max(...sessions.map((s) => s.messageHistory.length));

  const retValue: ChatBotHistoryItem[][] = [];
  for (let i = 0; i < count; i++) {
    const current = [];

    for (const session of sessions) {
      const currentMessage = session.messageHistory[i];
      if (currentMessage) {
        current.push(currentMessage);
      } else {
        current.push({
          type: ChatBotMessageType.AI,
          content: "",
          metadata: {},
        });
      }
    }

    retValue.push(current);
  }

  return retValue;
}
