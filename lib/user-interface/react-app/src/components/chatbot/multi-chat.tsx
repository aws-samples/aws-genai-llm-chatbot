import { useContext, useEffect, useLayoutEffect, useState } from "react";
import {
  SelectProps,
  SpaceBetween,
  Button,
  Select,
  ColumnLayout,
} from "@cloudscape-design/components";
import { v4 as uuidv4 } from "uuid";
import { AppContext } from "../../common/app-context";
import { ApiClient } from "../../common/api-client/api-client";
import ChatMessage from "./chat-message";
import MultiChatInputPanel, { ChatScrollState } from "./multi-chat-input-panel";
import styles from "../../styles/chat.module.scss";
import useWebSocket, { ReadyState } from "react-use-websocket";
import { OptionsHelper } from "../../common/helpers/options-helper";
import { Auth } from "aws-amplify";
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
} from "./types";

import {
  ApiResult,
  ModelItem,
  WorkspaceItem,
  ResultValue,
  LoadingStatus,
} from "../../common/types";
import { getSelectedModelMetadata, updateChatSessions } from "./utils";
import LLMConfigDialog from "./llm-config-dialog";

export interface ChatSession {
  configuration: ChatBotConfiguration;
  model?: SelectProps.Option;
  modelMetadata?: ModelItem;
  id: string;
  loading: boolean;
  running: boolean;
  messageHistory: ChatBotHistoryItem[];
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
  const appContext = useContext(AppContext);
  const [socketUrl, setSocketUrl] = useState<string | null>(null);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [models, setModels] = useState<ModelItem[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] =
    useState<SelectProps.Option | null>(workspaceDefaultOptions[0]);
  const [modelsStatus, setModelsStatus] = useState<LoadingStatus>("loading");
  const [workspacesStatus, setWorkspacesStatus] =
    useState<LoadingStatus>("loading");
  const [enableAddModels, setEnableAddModels] = useState(true);
  const [llmToConfig, setLlmToConfig] = useState<ChatSession | undefined>(
    undefined
  );
  const [showMetadata, setShowMetadata] = useState(false);

  const { sendJsonMessage, readyState } = useWebSocket(socketUrl, {
    share: true,
    shouldReconnect: () => true,
    onOpen: () => {
      const request: ChatBotHeartbeatRequest = {
        action: ChatBotAction.Heartbeat,
        modelInterface: ChatBotModelInterface.Langchain,
      };

      sendJsonMessage(request);
    },
    onMessage: (payload) => {
      const response: ChatBotMessageResponse = JSON.parse(payload.data);
      if (response.action === ChatBotAction.Heartbeat) {
        return;
      }
      const sessionId = response.data.sessionId;
      const session = chatSessions.filter((c) => c.id === sessionId)[0];
      if (session !== undefined) {
        updateChatSessions(session, response);
        setChatSessions([...chatSessions]);
      }
    },
  });

  useEffect(() => {
    if (!appContext) return;

    setChatSessions([createNewSession(), createNewSession()]); // reset all chats
    setEnableAddModels(true);
    (async () => {
      const apiClient = new ApiClient(appContext);
      const [session, modelsResult, workspacesResult] = await Promise.all([
        Auth.currentSession(),
        apiClient.models.getModels(),
        appContext?.config.rag_enabled
          ? apiClient.workspaces.getWorkspaces()
          : Promise.resolve<ApiResult<WorkspaceItem[]>>({ ok: true, data: [] }),
      ]);

      const jwtToken = session.getAccessToken().getJwtToken();

      if (jwtToken) {
        setSocketUrl(
          `${appContext.config.websocket_endpoint}?token=${jwtToken}`
        );
      }

      const models = ResultValue.ok(modelsResult)
        ? modelsResult.data.filter(
            (m) =>
              m.inputModalities.includes(ChabotInputModality.Text) &&
              m.outputModalities.includes(ChabotOutputModality.Text)
          )
        : [];

      const workspaces = ResultValue.ok(workspacesResult)
        ? workspacesResult.data
        : [];

      setModels(models);
      setWorkspaces(workspaces);
      setModelsStatus(ResultValue.ok(modelsResult) ? "finished" : "error");
      setWorkspacesStatus(
        ResultValue.ok(workspacesResult) ? "finished" : "error"
      );
    })();
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
      ChatScrollState.userHasScrolled = false; // check this

      const { name, provider } = OptionsHelper.parseValue(
        chatSession.model?.value
      );

      const value = message.trim();
      const request: ChatBotRunRequest = {
        action: ChatBotAction.Run,
        modelInterface: chatSession.modelMetadata!.interface,
        data: {
          modelName: name,
          provider: provider,
          sessionId: chatSession.id,
          files: [],
          workspaceId: selectedWorkspace?.value,
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
      sendJsonMessage(request);
    });
  };

  const addSession = () => {
    if (chatSessions.length >= 4) {
      return;
    }
    const session = createNewSession();

    setChatSessions([...chatSessions, session]);
  };

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

  return (
    <div className={styles.chat_container}>
      <SpaceBetween size="m">
        <SpaceBetween size="m" alignItems="end">
          <SpaceBetween size="m" direction="horizontal">
            <Button
              onClick={() => addSession()}
              disabled={!enableAddModels || chatSessions.length >= 4}
              iconName="add-plus"
            >
              Add model
            </Button>
            <Button
              onClick={() => {
                chatSessions.forEach((s) => {
                  s.messageHistory = [];
                  s.id = uuidv4();
                });
                setEnableAddModels(true);
                setChatSessions([...chatSessions]);
              }}
              iconName="remove"
            >
              Clear messages
            </Button>
          </SpaceBetween>
        </SpaceBetween>
        <ColumnLayout columns={chatSessions.length}>
          {chatSessions.map((chatSession) => (
            <SpaceBetween key={chatSession.id} direction="vertical" size="m">
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
                      Amazon Bedrock or alternatively deploy a self hosted model
                      on SageMaker or add API_KEY to Secrets Manager
                    </div>
                  }
                  filteringType="auto"
                  selectedOption={chatSession.model ?? null}
                  onChange={({ detail }) => {
                    chatSession.model = detail.selectedOption;
                    chatSession.modelMetadata =
                      getSelectedModelMetadata(models, detail.selectedOption) ??
                      undefined;
                    setChatSessions([...chatSessions]);
                  }}
                  options={OptionsHelper.getSelectOptionGroups(models)}
                />
                <div style={{ display: "flex", gap: "4px" }}>
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
                      setChatSessions([
                        ...chatSessions.filter((c) => c.id !== chatSession.id),
                      ]);
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
            </SpaceBetween>
          ))}
        </ColumnLayout>
        {messages.map((val, idx) => {
          if (val.length === 0) {
            return null;
          }

          if (val[0].type === ChatBotMessageType.Human) {
            return (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                key={idx}
              >
                <ChatMessage message={val[0]} />
              </div>
            );
          }

          return (
            <ColumnLayout columns={chatSessions.length} key={idx}>
              {val.map((message, idx) => (
                <ChatMessage
                  key={idx}
                  message={message}
                  configuration={chatSessions[idx].configuration}
                  showMetadata={showMetadata}
                />
              ))}
            </ColumnLayout>
          );
        })}
      </SpaceBetween>
      <div className={styles.input_container}>
        <MultiChatInputPanel
          running={false}
          workspaces={workspaces}
          onSendMessage={handleSendMessage}
          readyState={readyState}
          showMetadata={showMetadata}
          selectedWorkspace={selectedWorkspace ?? undefined}
          workspacesStatus={workspacesStatus}
          workspaceDefaultOptions={workspaceDefaultOptions}
          onShowMetadataChange={(showMetadata) => setShowMetadata(showMetadata)}
          onWorkspaceChange={(workspace) => setSelectedWorkspace(workspace)}
          enabled={enabled}
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
