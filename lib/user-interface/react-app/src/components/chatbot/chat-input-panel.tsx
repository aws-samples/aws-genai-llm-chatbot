import {
  Button,
  Select,
  SpaceBetween,
  StatusIndicator,
  SelectProps,
  Container,
  Spinner,
  Icon,
} from "@cloudscape-design/components";
import {
  Dispatch,
  SetStateAction,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";
import useWebSocket, { ReadyState } from "react-use-websocket";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";
import { Auth } from "aws-amplify";
import { AppContext } from "../../common/app-context";
import {
  ChatBotConfiguration,
  ChatBotAction,
  ChatBotHistoryItem,
  ChatBotMessageResponse,
  ChatBotMessageType,
  ChatBotRunRequest,
  ChatInputState,
} from "./types";
import TextareaAutosize from "react-textarea-autosize";
import { ApiClient } from "../../common/api-client/api-client";
import {
  ApiResult,
  LLMItem,
  ResultValue,
  WorkspaceItem,
} from "../../common/types";
import { OptionsHelper } from "../../common/helpers/options-helper";
import { useNavigate } from "react-router-dom";
import ConfigDialog from "./config-dialog";
import { StorageHelper } from "../../common/helpers/storage-helper";
import styles from "../../styles/chat.module.scss";
import { updateMessageHistory } from "./utils";

export interface ChatInputPanelProps {
  running: boolean;
  setRunning: Dispatch<SetStateAction<boolean>>;
  session: { id: string; loading: boolean };
  messageHistory: ChatBotHistoryItem[];
  setMessageHistory: Dispatch<SetStateAction<ChatBotHistoryItem[]>>;
  configuration: ChatBotConfiguration;
  setConfiguration: Dispatch<React.SetStateAction<ChatBotConfiguration>>;
}

export abstract class ChatScrollState {
  static userHasScrolled = false;
  static skipNextScrollEvent = false;
  static skipNextHistoryUpdate = false;
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

export default function ChatInputPanel(props: ChatInputPanelProps) {
  const appContext = useContext(AppContext);
  const navigate = useNavigate();
  const { transcript, listening, browserSupportsSpeechRecognition } =
    useSpeechRecognition();
  const [state, setState] = useState<ChatInputState>({
    value: "",
    selectedModel: null,
    selectedWorkspace: workspaceDefaultOptions[0],
    modelsStatus: "loading",
    workspacesStatus: "loading",
  });
  const [configDialogVisible, setConfigDialogVisible] = useState(false);
  const [socketUrl, setSocketUrl] = useState<string | null>(null);
  const { sendJsonMessage, readyState } = useWebSocket(socketUrl, {
    share: true,
    shouldReconnect: () => true,
    onMessage: (payload) => {
      const response: ChatBotMessageResponse = JSON.parse(payload.data);
      updateMessageHistory(
        props.session.id,
        props.messageHistory,
        props.setMessageHistory,
        response,
        setState
      );

      if (
        response.action === ChatBotAction.FinalResponse ||
        response.action === ChatBotAction.Error
      ) {
        props.setRunning(false);
      }
    },
  });

  useEffect(() => {
    if (transcript) {
      setState((state) => ({ ...state, value: transcript }));
    }
  }, [transcript]);

  useEffect(() => {
    if (!appContext) return;

    (async () => {
      const apiClient = new ApiClient(appContext);
      const [session, llmsResult, workspacesResult] = await Promise.all([
        Auth.currentSession(),
        apiClient.llms.getModels(),
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

      const models = ResultValue.ok(llmsResult) ? llmsResult.data : [];
      const workspaces = ResultValue.ok(workspacesResult)
        ? workspacesResult.data
        : [];

      const selectedModelOption = getSelectedModelOption(models);
      const selectedWorkspaceOption = appContext?.config.rag_enabled
        ? getSelectedWorkspaceOption(workspaces)
        : workspaceDefaultOptions[0];

      setState((state) => ({
        ...state,
        models,
        workspaces,
        selectedModel: selectedModelOption,
        selectedWorkspace: selectedWorkspaceOption,
        modelsStatus: ResultValue.ok(llmsResult) ? "finished" : "error",
        workspacesStatus: ResultValue.ok(workspacesResult)
          ? "finished"
          : "error",
      }));
    })();
  }, [appContext, state.modelsStatus]);

  useEffect(() => {
    const onWindowScroll = () => {
      if (ChatScrollState.skipNextScrollEvent) {
        ChatScrollState.skipNextScrollEvent = false;
        return;
      }

      const isScrollToTheEnd =
        Math.abs(
          window.innerHeight +
            window.scrollY -
            document.documentElement.scrollHeight
        ) <= 10;

      if (!isScrollToTheEnd) {
        ChatScrollState.userHasScrolled = true;
      } else {
        ChatScrollState.userHasScrolled = false;
      }
    };

    window.addEventListener("scroll", onWindowScroll);

    return () => {
      window.removeEventListener("scroll", onWindowScroll);
    };
  }, []);

  useLayoutEffect(() => {
    if (ChatScrollState.skipNextHistoryUpdate) {
      ChatScrollState.skipNextHistoryUpdate = false;
      return;
    }

    if (!ChatScrollState.userHasScrolled && props.messageHistory.length > 0) {
      ChatScrollState.skipNextScrollEvent = true;
      window.scrollTo({
        top: document.documentElement.scrollHeight + 1000,
        behavior: "instant",
      });
    }
  }, [props.messageHistory]);

  const handleSendMessage = () => {
    if (!state.selectedModel) return;
    if (props.running) return;
    if (readyState !== ReadyState.OPEN) return;
    ChatScrollState.userHasScrolled = false;

    const { name, provider } = OptionsHelper.parseValue(
      state.selectedModel.value
    );

    const value = state.value.trim();
    const request: ChatBotRunRequest = {
      action: ChatBotAction.Run,
      data: {
        modelName: name,
        provider: provider,
        sessionId: props.session.id,
        workspaceId: state.selectedWorkspace?.value,
        modelKwargs: {
          streaming: props.configuration.streaming,
          maxTokens: props.configuration.maxTokens,
          temperature: props.configuration.temperature,
          topP: props.configuration.topP,
        },
        text: value,
        mode: "chain",
      },
    };

    setState((state) => ({
      ...state,
      value: "",
    }));

    props.setRunning(true);

    props.setMessageHistory((prev) =>
      prev.concat(
        {
          type: ChatBotMessageType.Human,
          content: value,
          metadata: {},
        },
        {
          type: ChatBotMessageType.AI,
          content: "",
          metadata: {},
        }
      )
    );

    return sendJsonMessage(request);
  };

  const connectionStatus = {
    [ReadyState.CONNECTING]: "Connecting",
    [ReadyState.OPEN]: "Open",
    [ReadyState.CLOSING]: "Closing",
    [ReadyState.CLOSED]: "Closed",
    [ReadyState.UNINSTANTIATED]: "Uninstantiated",
  }[readyState];

  const llmsOptions = OptionsHelper.getSelectOptionGroups(state.models || []);

  const workspaceOptions = [
    ...workspaceDefaultOptions,
    ...OptionsHelper.getSelectOptions(state.workspaces || []),
  ];

  return (
    <SpaceBetween direction="vertical" size="l">
      <Container>
        <div className={styles.input_textarea_container}>
          <span>
            {browserSupportsSpeechRecognition ? (
              <Button
                iconName={listening ? "microphone-off" : "microphone"}
                variant="icon"
                onClick={() =>
                  listening
                    ? SpeechRecognition.stopListening()
                    : SpeechRecognition.startListening()
                }
              />
            ) : (
              <Icon name="microphone-off" variant="disabled" />
            )}
          </span>

          <TextareaAutosize
            className={styles.input_textarea}
            style={{ width: "100%" }}
            maxRows={6}
            minRows={1}
            maxLength={10000}
            spellCheck={true}
            autoFocus
            onChange={(e) =>
              setState((state) => ({ ...state, value: e.target.value }))
            }
            onKeyDown={(e) => {
              if (e.key == "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            value={state.value}
            placeholder={listening ? "Listening..." : "Send a message"}
          />
          <div style={{ marginLeft: "8px" }}>
            <Button
              disabled={
                readyState !== ReadyState.OPEN ||
                !state.models?.length ||
                !state.selectedModel ||
                props.running ||
                state.value.trim().length === 0 ||
                props.session.loading
              }
              onClick={handleSendMessage}
              iconAlign="right"
              iconName={!props.running ? "angle-right-double" : undefined}
              variant="primary"
            >
              {props.running ? (
                <>
                  Loading&nbsp;&nbsp;
                  <Spinner />
                </>
              ) : (
                "Send"
              )}
            </Button>
          </div>
        </div>
      </Container>
      <div className={styles.input_controls}>
        <div
          className={
            appContext?.config.rag_enabled
              ? styles.input_controls_selects_2
              : styles.input_controls_selects_1
          }
        >
          <Select
            disabled={props.running}
            statusType={state.modelsStatus}
            loadingText="Loading models (might take few seconds)..."
            placeholder="Select a model"
            empty={
              <div>
                No models available. Please make sure you have access to Amazon
                Bedrock or alternatively deploy a self hosted model on SageMaker
                or add API_KEY to Secrets Manager
              </div>
            }
            filteringType="auto"
            selectedOption={state.selectedModel}
            onChange={({ detail }) => {
              setState((state) => ({
                ...state,
                selectedModel: detail.selectedOption,
              }));
              if (detail.selectedOption?.value) {
                StorageHelper.setSelectedLLM(detail.selectedOption.value);
              }
            }}
            options={llmsOptions}
          />
          {appContext?.config.rag_enabled && true && (
            <Select
              disabled={props.running}
              loadingText="Loading workspaces (might take few seconds)..."
              statusType={state.workspacesStatus}
              placeholder="Select a workspace (RAG data source)"
              filteringType="auto"
              selectedOption={state.selectedWorkspace}
              options={workspaceOptions}
              onChange={({ detail }) => {
                if (detail.selectedOption?.value === "__create__") {
                  navigate("/rag/workspaces/create");
                } else {
                  setState((state) => ({
                    ...state,
                    selectedWorkspace: detail.selectedOption,
                  }));

                  StorageHelper.setSelectedWorkspaceId(
                    detail.selectedOption?.value ?? ""
                  );
                }
              }}
              empty={"No Workspaces available"}
            />
          )}
        </div>
        <div className={styles.input_controls_right}>
          <SpaceBetween direction="horizontal" size="xxs" alignItems="center">
            <div style={{ paddingTop: "1px" }}>
              <ConfigDialog
                sessionId={props.session.id}
                visible={configDialogVisible}
                setVisible={setConfigDialogVisible}
                configuration={props.configuration}
                setConfiguration={props.setConfiguration}
              />
              <Button
                iconName="settings"
                variant="icon"
                onClick={() => setConfigDialogVisible(true)}
              />
            </div>
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
          </SpaceBetween>
        </div>
      </div>
    </SpaceBetween>
  );
}

function getSelectedWorkspaceOption(
  workspaces: WorkspaceItem[]
): SelectProps.Option | null {
  let selectedWorkspaceOption: SelectProps.Option | null = null;

  const savedWorkspaceId = StorageHelper.getSelectedWorkspaceId();
  if (savedWorkspaceId) {
    const targetWorkspace = workspaces.find((w) => w.id === savedWorkspaceId);

    if (targetWorkspace) {
      selectedWorkspaceOption = OptionsHelper.getSelectOptions([
        targetWorkspace,
      ])[0];
    }
  }

  if (!selectedWorkspaceOption) {
    selectedWorkspaceOption = workspaceDefaultOptions[0];
  }

  return selectedWorkspaceOption;
}

function getSelectedModelOption(models: LLMItem[]): SelectProps.Option | null {
  let selectedModelOption: SelectProps.Option | null = null;
  const savedModel = StorageHelper.getSelectedLLM();

  if (savedModel) {
    const savedModelDetails = OptionsHelper.parseValue(savedModel);
    const targetModel = models.find(
      (m) =>
        m.name === savedModelDetails.name &&
        m.provider === savedModelDetails.provider
    );

    if (targetModel) {
      selectedModelOption = OptionsHelper.getSelectOptionGroups([
        targetModel,
      ])[0].options[0];
    }
  }

  let candidate: LLMItem | undefined = undefined;
  if (!selectedModelOption) {
    const bedrockModels = models.filter((m) => m.provider === "bedrock");
    const sageMakerModels = models.filter((m) => m.provider === "sagemaker");
    const openAIModels = models.filter((m) => m.provider === "openai");

    candidate = bedrockModels.find((m) => m.name === "anthropic.claude-v2");
    if (!candidate) {
      candidate = bedrockModels.find((m) => m.name === "anthropic.claude-v1");
    }

    if (!candidate) {
      candidate = bedrockModels.find(
        (m) => m.name === "amazon.titan-tg1-large"
      );
    }

    if (!candidate) {
      candidate = bedrockModels.find((m) => m.name.startsWith("amazon.titan-"));
    }

    if (!candidate && sageMakerModels.length > 0) {
      candidate = sageMakerModels[0];
    }

    if (openAIModels.length > 0) {
      if (!candidate) {
        candidate = openAIModels.find((m) => m.name === "gpt-4");
      }

      if (!candidate) {
        candidate = openAIModels.find((m) => m.name === "gpt-3.5-turbo-16k");
      }
    }

    if (!candidate && bedrockModels.length > 0) {
      candidate = bedrockModels[0];
    }

    if (candidate) {
      selectedModelOption = OptionsHelper.getSelectOptionGroups([candidate])[0]
        .options[0];
    }
  }

  return selectedModelOption;
}
