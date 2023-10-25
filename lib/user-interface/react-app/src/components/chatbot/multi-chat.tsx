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
import { ResultValue } from "../../common/types";
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
  ChatBotModelInterface,
} from "./types";

import { ApiResult, ModelItem, WorkspaceItem } from "../../common/types";
import ConfigDialog from "./config-dialog";
import { updateChatSessions } from "./utils";
import LLMConfigDialog from "./llm-config-dialog";

export interface ChatSession {
  configuration: ChatBotConfiguration;
  model?: SelectProps.Option;
  id: string;
  loading: boolean;
  running: boolean;
  messageHistory: ChatBotHistoryItem[];
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
    setChatSessions([]); // reset all chats
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

      const models = ResultValue.ok(modelsResult) ? modelsResult.data.filter(m => m.interface === ChatBotModelInterface.Langchain) : [];
      setModels(models);
      const workspaces = ResultValue.ok(workspacesResult)
        ? workspacesResult.data
        : [];
      setWorkspaces(workspaces);
      // TODO : update this when fixed local storage for multi chat

      // const selectedModelOption = getSelectedModelOption(models);
      // const selectedWorkspaceOption = appContext?.config.rag_enabled
      //   ? getSelectedWorkspaceOption(workspaces)
      //   : workspaceDefaultOptions[0];

      // setState((state) => ({
      //   ...state,
      //   models,
      //   workspaces,
      //   selectedModel: selectedModelOption,
      //   selectedWorkspace: selectedWorkspaceOption,
      //   modelsStatus: ResultValue.ok(llmsResult) ? "finished" : "error",
      //   workspacesStatus: ResultValue.ok(workspacesResult)
      //     ? "finished"
      //     : "error",
      // }));
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
        modelInterface: ChatBotModelInterface.Langchain,
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

      setChatSessions(chatSessions);
      sendJsonMessage(request);
    });
  };

  const createSession = () => {
    if (chatSessions.length >= 4) {
      return;
    }
    const session: ChatSession = {
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

    //const apiClient = new ApiClient(appContext);
    // Retrieve session
    // const result = await apiClient.sessions.getSession(props.sessionId);

    // if (ResultValue.ok(result)) {
    //   if (result.data?.history) {
    //     ChatScrollState.skipNextHistoryUpdate = true;
    //     ChatScrollState.skipNextScrollEvent = true;
    //     setMessageHistory(result.data.history);

    //     window.scrollTo({
    //       top: 0,
    //       behavior: "instant",
    //     });
    //   }
    //}

    setChatSessions([...chatSessions, session]);
  };

  return (
    <div className={styles.chat_container}>
      <SpaceBetween size="m">
        <SpaceBetween size="m" direction="horizontal">
          <Button onClick={() => createSession()} disabled={!enableAddModels}>
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
          {chatSessions.map((chatSession, idx) => (
            <SpaceBetween key={idx} direction="vertical" size="m">
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
                    // if (detail.selectedOption?.value) {
                    //   StorageHelper.setSelectedLLM(detail.selectedOption.value);
                    // }
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
                  setVisible={(_) => setLlmToConfig(undefined)}
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

// TODO: adapt local storage to multichat

// function getSelectedModelOption(models: LLMItem[]): SelectProps.Option | null {
//   let selectedModelOption: SelectProps.Option | null = null;
//   const savedModel = StorageHelper.getSelectedLLM();

//   if (savedModel) {
//     const savedModelDetails = OptionsHelper.parseValue(savedModel);
//     const targetModel = models.find(
//       (m) =>
//         m.name === savedModelDetails.name &&
//         m.provider === savedModelDetails.provider
//     );

//     if (targetModel) {
//       selectedModelOption = OptionsHelper.getSelectOptionGroups([
//         targetModel,
//       ])[0].options[0];
//     }
//   }

//   let candidate: LLMItem | undefined = undefined;
//   if (!selectedModelOption) {
//     const bedrockModels = models.filter((m) => m.provider === "bedrock");
//     const sageMakerModels = models.filter((m) => m.provider === "sagemaker");
//     const openAIModels = models.filter((m) => m.provider === "openai");

//     candidate = bedrockModels.find((m) => m.name === "anthropic.claude-v2");
//     if (!candidate) {
//       candidate = bedrockModels.find((m) => m.name === "anthropic.claude-v1");
//     }

//     if (!candidate) {
//       candidate = bedrockModels.find(
//         (m) => m.name === "amazon.titan-tg1-large"
//       );
//     }

//     if (!candidate) {
//       candidate = bedrockModels.find((m) => m.name.startsWith("amazon.titan-"));
//     }

//     if (!candidate && sageMakerModels.length > 0) {
//       candidate = sageMakerModels[0];
//     }

//     if (openAIModels.length > 0) {
//       if (!candidate) {
//         candidate = openAIModels.find((m) => m.name === "gpt-4");
//       }

//       if (!candidate) {
//         candidate = openAIModels.find((m) => m.name === "gpt-3.5-turbo-16k");
//       }
//     }

//     if (!candidate && bedrockModels.length > 0) {
//       candidate = bedrockModels[0];
//     }

//     if (candidate) {
//       selectedModelOption = OptionsHelper.getSelectOptionGroups([candidate])[0]
//         .options[0];
//     }
//   }

//   return selectedModelOption;
// }

// function getSelectedWorkspaceOption(
//   workspaces: WorkspaceItem[]
// ): SelectProps.Option | null {
//   let selectedWorkspaceOption: SelectProps.Option | null = null;

//   const savedWorkspaceId = StorageHelper.getSelectedWorkspaceId();
//   if (savedWorkspaceId) {
//     const targetWorkspace = workspaces.find((w) => w.id === savedWorkspaceId);

//     if (targetWorkspace) {
//       selectedWorkspaceOption = OptionsHelper.getSelectOptions([
//         targetWorkspace,
//       ])[0];
//     }
//   }

//   if (!selectedWorkspaceOption) {
//     selectedWorkspaceOption = workspaceDefaultOptions[0];
//   }

//   return selectedWorkspaceOption;
// }
