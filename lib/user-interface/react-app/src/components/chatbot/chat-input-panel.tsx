import {
  Button,
  Container,
  Icon,
  Select,
  SelectProps,
  SpaceBetween,
  Spinner,
  StatusIndicator,
} from "@cloudscape-design/components";
import {
  Dispatch,
  SetStateAction,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";
import TextareaAutosize from "react-textarea-autosize";
import { ReadyState } from "react-use-websocket";
import { ApiClient } from "../../common/api-client/api-client";
import { AppContext } from "../../common/app-context";
import { OptionsHelper } from "../../common/helpers/options-helper";
import { StorageHelper } from "../../common/helpers/storage-helper";
import { API } from "aws-amplify";
import { GraphQLSubscription, GraphQLResult } from "@aws-amplify/api";
import { Model, ReceiveMessagesSubscription, Workspace } from "../../API";
import { LoadingStatus, ModelInterface } from "../../common/types";
import styles from "../../styles/chat.module.scss";
import ConfigDialog from "./config-dialog";
import ImageDialog from "./image-dialog";
import {
  ChabotInputModality,
  ChatBotHeartbeatRequest,
  ChatBotAction,
  ChatBotConfiguration,
  ChatBotHistoryItem,
  ChatBotMessageResponse,
  ChatBotMessageType,
  ChatBotMode,
  ChatBotRunRequest,
  ChatInputState,
  ImageFile,
  ChatBotModelInterface,
  ChatBotToken,
} from "./types";
import { sendQuery } from "../../graphql/mutations";
import { getSelectedModelMetadata, updateMessageHistoryRef } from "./utils";
import { receiveMessages } from "../../graphql/subscriptions";
import { Utils } from "../../common/utils";

export interface ChatInputPanelProps {
  running: boolean;
  setRunning: Dispatch<SetStateAction<boolean>>;
  session: { id: string; loading: boolean };
  messageHistory: ChatBotHistoryItem[];
  setMessageHistory: (history: ChatBotHistoryItem[]) => void;
  configuration: ChatBotConfiguration;
  setConfiguration: Dispatch<React.SetStateAction<ChatBotConfiguration>>;
  setInitErrorMessage?: (error?: string) => void;
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
    selectedModelMetadata: null,
    selectedWorkspace: workspaceDefaultOptions[0],
    modelsStatus: "loading",
    workspacesStatus: "loading",
  });
  const [configDialogVisible, setConfigDialogVisible] = useState(false);
  const [imageDialogVisible, setImageDialogVisible] = useState(false);
  const [files, setFiles] = useState<ImageFile[]>([]);
  const [readyState, setReadyState] = useState<ReadyState>(
    ReadyState.UNINSTANTIATED
  );

  const messageHistoryRef = useRef<ChatBotHistoryItem[]>([]);

  useEffect(() => {
    messageHistoryRef.current = props.messageHistory;
  }, [props.messageHistory]);

  useEffect(() => {
    async function subscribe() {
      console.log("Subscribing to AppSync");
      const messageTokens: { [key: string]: ChatBotToken[] } = {};
      setReadyState(ReadyState.CONNECTING);
      const sub = await API.graphql<
        GraphQLSubscription<ReceiveMessagesSubscription>
      >({
        query: receiveMessages,
        variables: {
          sessionId: props.session.id,
        },
        authMode: "AMAZON_COGNITO_USER_POOLS",
      }).subscribe({
        next: ({ value }) => {
          const data = value.data!.receiveMessages?.data;
          if (data !== undefined && data !== null) {
            const response: ChatBotMessageResponse = JSON.parse(data);
            console.log("message data", response.data);
            if (response.action === ChatBotAction.Heartbeat) {
              console.log("Heartbeat pong!");
              return;
            }

            updateMessageHistoryRef(
              props.session.id,
              messageHistoryRef.current,
              response,
              messageTokens
            );

            if (
              response.action === ChatBotAction.FinalResponse ||
              response.action === ChatBotAction.Error
            ) {
              console.log("Final message received");
              props.setRunning(false);
            }
            props.setMessageHistory([...messageHistoryRef.current]);
          }
        },
        error: (error) => console.warn(error),
      });
      return sub;
    }

    const sub = subscribe();
    sub
      .then(() => {
        setReadyState(ReadyState.OPEN);
        console.log(`Subscribed to session ${props.session.id}`);
        const request: ChatBotHeartbeatRequest = {
          action: ChatBotAction.Heartbeat,
          modelInterface: ChatBotModelInterface.Langchain,
          data: {
            sessionId: props.session.id,
          },
        };
        const result = API.graphql({
          query: sendQuery,
          variables: {
            data: JSON.stringify(request),
          },
        });
        Promise.all([result])
          .then((x) => console.log(`Query successful`, x))
          .catch((err) => {
            console.log(Utils.getErrorMessage(err));
          });
      })
      .catch((err) => {
        console.log(err);
        setReadyState(ReadyState.CLOSED);
      });

    return () => {
      sub
        .then((s) => {
          console.log(`Unsubscribing from ${props.session.id}`);
          s.unsubscribe();
        })
        .catch((err) => console.log(err));
    };
    // eslint-disable-next-line
  }, [props.session.id]);

  useEffect(() => {
    if (transcript) {
      setState((state) => ({ ...state, value: transcript }));
    }
  }, [transcript]);

  useEffect(() => {
    if (!appContext) return;

    (async () => {
      const apiClient = new ApiClient(appContext);
      let workspaces: Workspace[] = [];
      let workspacesStatus: LoadingStatus = "finished";
      /* eslint-disable-next-line  @typescript-eslint/no-explicit-any */
      let modelsResult: GraphQLResult<any>;
      /* eslint-disable-next-line  @typescript-eslint/no-explicit-any */
      let workspacesResult: GraphQLResult<any>;
      try {
        if (props.setInitErrorMessage) props.setInitErrorMessage(undefined);
        if (appContext?.config.rag_enabled) {
          [modelsResult, workspacesResult] = await Promise.all([
            apiClient.models.getModels(),
            apiClient.workspaces.getWorkspaces(),
          ]);
          workspaces = workspacesResult.data?.listWorkspaces;
          workspacesStatus =
            workspacesResult.errors === undefined ? "finished" : "error";
        } else {
          modelsResult = await apiClient.models.getModels();
        }

        const models = modelsResult.data ? modelsResult.data.listModels : [];

        const selectedModelOption = getSelectedModelOption(models);
        const selectedModelMetadata = getSelectedModelMetadata(
          models,
          selectedModelOption
        );
        const selectedWorkspaceOption = appContext?.config.rag_enabled
          ? getSelectedWorkspaceOption(workspaces)
          : workspaceDefaultOptions[0];

        setState((state) => ({
          ...state,
          models,
          workspaces,
          selectedModel: selectedModelOption,
          selectedModelMetadata,
          selectedWorkspace: selectedWorkspaceOption,
          modelsStatus: "finished",
          workspacesStatus: workspacesStatus,
        }));
      } catch (error) {
        console.log(Utils.getErrorMessage(error));
        if (props.setInitErrorMessage)
          props.setInitErrorMessage(Utils.getErrorMessage(error));
        setState((state) => ({
          ...state,
          modelsStatus: "error",
        }));
        setReadyState(ReadyState.CLOSED);
      }
    })();
  }, [appContext, props.session.id]); // eslint-disable-line react-hooks/exhaustive-deps

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

  useEffect(() => {
    if (!appContext) return;

    const apiClient = new ApiClient(appContext);
    const getSignedUrls = async () => {
      if (props.configuration?.files as ImageFile[]) {
        const files: ImageFile[] = [];
        for await (const file of props.configuration?.files ?? []) {
          const signedUrl = (
            await apiClient.sessions.getFileSignedUrl(file.key)
          ).data?.getFileURL;
          if (signedUrl) {
            files.push({
              ...file,
              url: signedUrl,
            });
          }
        }

        setFiles(files);
      }
    };

    if (props.configuration.files?.length) {
      getSignedUrls().catch((e) => {
        console.log("Unable to get signed URL", e);
      });
    }
  }, [appContext, props.configuration]);

  const hasImagesInChatHistory = function (): boolean {
    return (
      messageHistoryRef.current.filter(
        (x) =>
          x.type == ChatBotMessageType.Human &&
          x.metadata?.files &&
          (x.metadata.files as object[]).length > 0
      ).length > 0
    );
  };

  const handleSendMessage = async (): Promise<void> => {
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
      modelInterface:
        (props.configuration.files && props.configuration.files.length > 0) ||
        (hasImagesInChatHistory() &&
          state.selectedModelMetadata?.inputModalities.includes(
            ChabotInputModality.Image
          ))
          ? "multimodal"
          : (state.selectedModelMetadata!.interface as ModelInterface),
      data: {
        mode: ChatBotMode.Chain,
        text: value,
        files: props.configuration.files ?? [],
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
      },
    };
    console.log(request);
    setState((state) => ({
      ...state,
      value: "",
    }));
    setFiles([]);

    props.setConfiguration({
      ...props.configuration,
      files: [],
    });

    props.setRunning(true);
    messageHistoryRef.current = [
      ...messageHistoryRef.current,

      {
        type: ChatBotMessageType.Human,
        content: value,
        metadata: {
          ...props.configuration,
        },
        tokens: [],
      },
      {
        type: ChatBotMessageType.AI,
        tokens: [],
        content: "",
        metadata: {},
      },
    ];

    props.setMessageHistory(messageHistoryRef.current);

    try {
      await API.graphql({
        query: sendQuery,
        variables: {
          data: JSON.stringify(request),
        },
      });
    } catch (err) {
      console.log(Utils.getErrorMessage(err));
      props.setRunning(false);
      messageHistoryRef.current[messageHistoryRef.current.length - 1].content =
        "**Error**, Unable to process the request: " +
        Utils.getErrorMessage(err);
      props.setMessageHistory(messageHistoryRef.current);
    }
  };

  const connectionStatus = {
    [ReadyState.CONNECTING]: "Connecting",
    [ReadyState.OPEN]: "Open",
    [ReadyState.CLOSING]: "Closing",
    [ReadyState.CLOSED]: "Closed",
    [ReadyState.UNINSTANTIATED]: "Uninstantiated",
  }[readyState];

  const modelsOptions = OptionsHelper.getSelectOptionGroups(state.models ?? []);

  const workspaceOptions = [
    ...workspaceDefaultOptions,
    ...OptionsHelper.getSelectOptions(state.workspaces ?? []),
  ];

  return (
    <SpaceBetween direction="vertical" size="l">
      <Container>
        <div className={styles.input_textarea_container}>
          <SpaceBetween size="xxs" direction="horizontal" alignItems="center">
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
            {state.selectedModelMetadata?.inputModalities.includes(
              ChabotInputModality.Image
            ) && (
              <Button
                variant="icon"
                onClick={() => setImageDialogVisible(true)}
                iconSvg={
                  <svg viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg">
                    <rect
                      x="2"
                      y="2"
                      width="19"
                      height="19"
                      rx="2"
                      ry="2"
                    ></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <polyline points="21 15 16 10 5 21"></polyline>
                  </svg>
                }
              ></Button>
            )}
          </SpaceBetween>
          <ImageDialog
            sessionId={props.session.id}
            visible={imageDialogVisible}
            setVisible={setImageDialogVisible}
            configuration={props.configuration}
            setConfiguration={props.setConfiguration}
          />
          <TextareaAutosize
            data-locator="prompt-input"
            className={styles.input_textarea}
            maxRows={6}
            minRows={1}
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
            {state.selectedModelMetadata?.inputModalities.includes(
              ChabotInputModality.Image
            ) &&
              files.length > 0 &&
              files.map((file, idx) => (
                <img
                  key={idx}
                  onClick={() => setImageDialogVisible(true)}
                  src={file.url}
                  style={{
                    borderRadius: "4px",
                    cursor: "pointer",
                    maxHeight: "30px",
                    float: "left",
                    marginRight: "8px",
                  }}
                />
              ))}
            <Button
              data-locator="submit-prompt"
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
            data-locator="select-model"
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
                selectedModelMetadata: getSelectedModelMetadata(
                  state.models,
                  detail.selectedOption
                ),
              }));
              if (detail.selectedOption?.value) {
                StorageHelper.setSelectedLLM(detail.selectedOption.value);
              }
            }}
            options={modelsOptions}
          />
          {appContext?.config.rag_enabled && (
            <Select
              disabled={
                props.running || !state.selectedModelMetadata?.ragSupported
              }
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
  workspaces: Workspace[]
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

function getSelectedModelOption(models: Model[]): SelectProps.Option | null {
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

  let candidate: Model | undefined = undefined;
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
