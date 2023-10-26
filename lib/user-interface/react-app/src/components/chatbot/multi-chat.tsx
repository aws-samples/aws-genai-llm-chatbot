import { useContext, useEffect, useState } from "react";
import {
  SelectProps,
  SpaceBetween,
  Button,
  Select,
  ColumnLayout,
  Grid,
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
} from "./types";

import { ApiResult, ModelItem, WorkspaceItem, ResultValue } from "../../common/types";
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
  }
}

export default function MultiChat() {
  const appContext = useContext(AppContext);
  const [socketUrl, setSocketUrl] = useState<string | null>(null);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [models, setModels] = useState<ModelItem[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [enableAddModels, setEnableAddModels] = useState(true);
  const [llmToConfig, setLlmToConfig] = useState<ChatSession | undefined>(
    undefined
  );
  const [showMetadata, setShowMetadata] = useState(false);

  const { sendJsonMessage, readyState } = useWebSocket(socketUrl, {
    share: true,
    shouldReconnect: () => true,
    onMessage: (payload) => {
      // Check the session id for the response and update the corresponding session
      const response: ChatBotMessageResponse = JSON.parse(payload.data);
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
            (m) => m.inputModalities.includes(ChabotInputModality.Text) && m.outputModalities.includes(ChabotOutputModality.Text))
        : [];
      setModels(models);
      const workspaces = ResultValue.ok(workspacesResult)
        ? workspacesResult.data
        : [];
      setWorkspaces(workspaces);
    })();
  }, [appContext]);

  const handleSendMessage = (message: string): void => {
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
          workspaceId: undefined, // state.selectedWorkspace?.value, // need to move this to the chat
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

  return (
    <div className={styles.chat_container}>
      <SpaceBetween size="m">
        <SpaceBetween size="m" direction="horizontal">
          <Button onClick={() => addSession()} disabled={!enableAddModels}>
            Create Chat Session
          </Button>
          <Button
            onClick={() => {
              setChatSessions(chatSessions.slice(0, chatSessions.length - 1));
            }}
            disabled={!enableAddModels}
          >
            Remove Chat Session
          </Button>
          <Button
            onClick={() => {
              chatSessions.forEach((s) => (s.messageHistory = []));
              setEnableAddModels(true);
              setChatSessions([...chatSessions]);
            }}
          >
            Clear messages
          </Button>
        </SpaceBetween>
        <ColumnLayout columns={chatSessions.length}>
          {chatSessions.map((chatSession) => (
            <SpaceBetween key={chatSession.id} direction="vertical" size="m">
              <Grid gridDefinition={[{ colspan: 11 }, { colspan: 1 }]}>
                <Select
                  disabled={!enableAddModels}
                  loadingText="Loading models (might take few seconds)..."
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
                    chatSession.modelMetadata = getSelectedModelMetadata(models, detail.selectedOption) ?? undefined;
                    setChatSessions([...chatSessions]);
                  }}
                  options={OptionsHelper.getSelectOptionGroups(models)}
                />
                <Button
                  iconName="settings"
                  variant="icon"
                  onClick={() => setLlmToConfig(chatSession)}
                ></Button>
              </Grid>
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
              {chatSession.messageHistory.map((message, idx) => (
                <ChatMessage
                  key={idx}
                  message={message}
                  configuration={chatSession.configuration}
                  showMetadata={showMetadata}
                />
              ))}
            </SpaceBetween>
          ))}
        </ColumnLayout>

        {
          <div className={styles.welcome_text}>
            {chatSessions.length == 0 && (
              <center style={{ color: "lightgray" }}>AWS GenAI Chatbot</center>
            )}
          </div>
        }
      </SpaceBetween>
      <div className={styles.input_container}>
        <MultiChatInputPanel
          running={false}
          workspaces={workspaces}
          onSendMessage={handleSendMessage}
          readyState={readyState}
          showMetadata={showMetadata}
          onChange={(v) => setShowMetadata(v)}
          enabled={
            readyState === ReadyState.OPEN &&
            chatSessions.length > 0 &&
            !chatSessions.some((c) => c.running) &&
            !chatSessions.some((c) => c.loading) &&
            !chatSessions.some((c) => !c.model)
          }
        />
      </div>
    </div>
  );
}
