import {
  Box,
  Button,
  Select,
  SelectProps,
  SpaceBetween,
  StatusIndicator,
  PromptInput,
  ButtonGroup,
  ButtonGroupProps,
  FileTokenGroup,
} from "@cloudscape-design/components";
import {
  Dispatch,
  SetStateAction,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";
import { ReadyState } from "react-use-websocket";
import { ApiClient } from "../../common/api-client/api-client";
import { AppContext } from "../../common/app-context";
import { OptionsHelper } from "../../common/helpers/options-helper";
import { StorageHelper } from "../../common/helpers/storage-helper";
import { API } from "aws-amplify";
import { GraphQLSubscription, GraphQLResult } from "@aws-amplify/api";
import {
  Application,
  GetApplicationQuery,
  Model,
  ReceiveMessagesSubscription,
  Workspace,
} from "../../API";
import { LoadingStatus, ModelInterface } from "../../common/types";
import styles from "../../styles/chat.module.scss";
import ConfigDialog from "./config-dialog";
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
  SessionFile,
  ChatBotModelInterface,
  ChatBotToken,
  ChabotOutputModality,
} from "./types";
import { sendQuery } from "../../graphql/mutations";
import { getSelectedModelMetadata, updateMessageHistoryRef } from "./utils";
import { receiveMessages } from "../../graphql/subscriptions";
import { Utils } from "../../common/utils";
import FileDialog from "./file-dialog";

export interface ChatInputPanelProps {
  running: boolean;
  setRunning: Dispatch<SetStateAction<boolean>>;
  session: { id: string; loading: boolean };
  messageHistory: ChatBotHistoryItem[];
  setMessageHistory: (history: ChatBotHistoryItem[]) => void;
  configuration: ChatBotConfiguration;
  setConfiguration: Dispatch<React.SetStateAction<ChatBotConfiguration>>;
  setInitErrorMessage?: (error?: string) => void;
  applicationId?: string;
  setApplication: Dispatch<React.SetStateAction<Application>>;
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
    applicationStatus: "loading",
  });
  const [configDialogVisible, setConfigDialogVisible] = useState(false);
  const [imageDialogVisible, setImageDialogVisible] = useState(false);
  const [documentDialogVisible, setDocumentDialogVisible] = useState(false);
  const [videoDialogVisible, setVideoDialogVisible] = useState(false);
  const [images, setImages] = useState<SessionFile[]>([]);
  const [documents, setDocuments] = useState<SessionFile[]>([]);
  const [videos, setVideos] = useState<SessionFile[]>([]);
  const [filesBlob, setFilesBlob] = useState<File[]>([]);
  const [outputModality, setOutputModality] = useState<ChabotOutputModality>(
    ChabotOutputModality.Text
  );
  const [application, setApplication] =
    useState<GetApplicationQuery["getApplication"]>(null);
  const [readyState, setReadyState] = useState<ReadyState>(
    ReadyState.UNINSTANTIATED
  );

  const messageHistoryRef = useRef<ChatBotHistoryItem[]>([]);
  const isMediaGenerationModel = (outputModality?: ChabotOutputModality) => {
    if (!outputModality) return false;
    return [ChabotOutputModality.Image, ChabotOutputModality.Video].includes(
      outputModality
    );
  };

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
    if (props.applicationId) {
      (async () => {
        try {
          if (props.setInitErrorMessage) props.setInitErrorMessage(undefined);
          const apiClient = new ApiClient(appContext);
          const applicationResult = await apiClient.applications.getApplication(
            props.applicationId ?? ""
          );
          const application = applicationResult.data?.getApplication;
          if (application) {
            props.setApplication(application);
            setApplication(application);

            const outputModalities = (application.outputModalities ??
              []) as ChabotOutputModality[];
            setOutputModality(outputModalities[0] ?? ChabotOutputModality.Text);
          }
        } catch (error) {
          console.log(Utils.getErrorMessage(error));
          if (props.setInitErrorMessage)
            props.setInitErrorMessage(Utils.getErrorMessage(error));
          setState((state) => ({
            ...state,
            applicationStatus: "error",
          }));
          setReadyState(ReadyState.CLOSED);
        }
      })();
    } else {
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
          const selectedWorkspace = isMediaGenerationModel(
            selectedModelMetadata?.outputModalities[0] as ChabotOutputModality
          )
            ? workspaceDefaultOptions[0]
            : getSelectedWorkspaceOption(workspaces);

          const selectedWorkspaceOption = appContext?.config.rag_enabled
            ? selectedWorkspace
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
    }
  }, [appContext, props.session.id, props.applicationId]); // eslint-disable-line react-hooks/exhaustive-deps

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
      if (props.configuration?.images as SessionFile[]) {
        const files: SessionFile[] = [];
        for await (const file of props.configuration?.images ?? []) {
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

        setImages(files);
      }
    };

    if (props.configuration.images?.length) {
      getSignedUrls().catch((e) => {
        console.log("Unable to get signed URL", e);
      });
    }
    if (props.configuration.documents?.length) {
      setDocuments(props.configuration?.documents);
    }
    if (props.configuration.videos?.length) {
      setVideos(props.configuration?.videos);
    }
    // add uploaded files blob for input file icon display
    const { images, documents, videos } = props?.configuration?.filesBlob ?? {};
    setFilesBlob([...(images || []), ...(documents || []), ...(videos || [])]);
  }, [appContext, props.configuration]);

  /* Updates the output modality when a model is selected and sets default workspace
   * for media generation models.
   */
  useEffect(() => {
    const metadata = state.selectedModelMetadata;
    if (!metadata?.outputModalities?.length) return;

    const defaultOutputModality = metadata
      .outputModalities[0] as ChabotOutputModality;
    setOutputModality(defaultOutputModality);

    const isMediaModel = isMediaGenerationModel(defaultOutputModality);
    if (isMediaModel) {
      setState((prevState) => ({
        ...prevState,
        selectedWorkspace: workspaceDefaultOptions[0],
      }));
    }
  }, [state.selectedModelMetadata]);

  const getChatBotMode = (
    outputModality: ChabotOutputModality
  ): ChatBotMode => {
    const chatBotModeMap = {
      [ChabotOutputModality.Text]: ChatBotMode.Chain,
      [ChabotOutputModality.Image]: ChatBotMode.ImageGeneration,
      [ChabotOutputModality.Video]: ChatBotMode.VideoGeneration,
    } as { [key: string]: ChatBotMode };

    return chatBotModeMap[outputModality] ?? ChatBotMode.Chain;
  };

  const handleSendMessage = async (): Promise<void> => {
    if (!state.selectedModel && !props.applicationId) return;
    if (props.running) return;
    if (readyState !== ReadyState.OPEN) return;
    ChatScrollState.userHasScrolled = false;

    let name, provider;
    if (!props.applicationId) {
      ({ name, provider } = OptionsHelper.parseValue(
        state.selectedModel?.value
      ));
    }

    const value = state.value.trim();
    const request: ChatBotRunRequest = props.applicationId
      ? {
          action: ChatBotAction.Run,
          modelInterface: "langchain", // We allow only langchain models in app creation
          data: {
            mode: getChatBotMode(outputModality),
            text: value,
            images: props.configuration.images ?? [],
            documents: props.configuration.documents ?? [],
            videos: props.configuration.videos ?? [],
            sessionId: props.session.id,
          },
          applicationId: props.applicationId ?? "",
        }
      : {
          action: ChatBotAction.Run,
          modelInterface: state.selectedModelMetadata!
            .interface as ModelInterface,
          data: {
            mode: getChatBotMode(outputModality),
            text: value,
            images: props.configuration.images ?? [],
            documents: props.configuration.documents ?? [],
            videos: props.configuration.videos ?? [],
            modelName: name,
            provider: provider,
            sessionId: props.session.id,
            workspaceId: state.selectedWorkspace?.value,
            modelKwargs: {
              streaming: props.configuration.streaming,
              maxTokens: props.configuration.maxTokens,
              temperature: props.configuration.temperature,
              topP: props.configuration.topP,
              seed: props.configuration.seed,
            },
          },
        };

    setState((state) => ({
      ...state,
      value: "",
    }));

    props.setConfiguration({
      ...props.configuration,
      filesBlob: {
        images: [],
        documents: [],
        videos: [],
      },
      images: [],
      documents: [],
      videos: [],
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
        metadata: {
          images: [],
          documents: [],
          videos: [],
        },
      },
    ];

    setImages([]);
    setDocuments([]);
    setVideos([]);

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

  const secondaryActions: ButtonGroupProps.ItemOrGroup[] = [
    {
      type: "icon-button",
      id: "record",
      iconName: listening ? "microphone-off" : "microphone",
      text: "Record",
      disabled: props.running || !browserSupportsSpeechRecognition,
    },
  ];
  if (
    (!props.applicationId &&
      state.selectedModelMetadata?.inputModalities.includes(
        ChabotInputModality.Image
      )) ||
    (props.applicationId && application?.allowImageInput)
  ) {
    secondaryActions.push({
      type: "icon-button",
      id: "images",
      iconSvg: (
        <svg viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg">
          <rect x="2" y="2" width="19" height="19" rx="2" ry="2"></rect>
          <circle cx="8.5" cy="8.5" r="1.5"></circle>
          <polyline points="21 15 16 10 5 21"></polyline>
        </svg>
      ),
      disabled: props.running,
      text: images?.length
        ? `Change images (${images?.length} added)`
        : "Add images",
    });
  }
  if (
    (!props.applicationId &&
      state.selectedModelMetadata?.inputModalities.includes(
        ChabotInputModality.Video
      )) ||
    (props.applicationId && application?.allowVideoInput)
  ) {
    secondaryActions.push({
      type: "icon-button",
      id: "videos",
      iconSvg: (
        <svg viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg">
          <rect width="18" height="19" x="3" y="2" strokeWidth="2" />
          <path d="M9 7l8 5-8 5V7z" />
        </svg>
      ),
      disabled: props.running,
      text: videos?.length
        ? `Change videos (${videos?.length} added)`
        : "Add videos",
    });
  }
  if (
    (!props.applicationId &&
      state.selectedModelMetadata?.inputModalities.includes(
        ChabotInputModality.Document
      )) ||
    (props.applicationId && application?.allowDocumentInput)
  ) {
    secondaryActions.push({
      type: "icon-button",
      id: "documents",
      iconName: "file",
      disabled: props.running,
      text: documents?.length
        ? `Change documents (${documents?.length} added)`
        : "Add documents",
    });
  }

  const outputModalityIcon = useMemo(() => {
    switch (outputModality) {
      case ChabotOutputModality.Text:
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="2" y="2" width="12" height="12" rx="1" />
            <path d="M5 5H11" />
            <path d="M8 5V11" />
            <path d="M11 11V11" />
          </svg>
        );
      case ChabotOutputModality.Image:
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="2" y="2" width="12" height="12" rx="1" />
            <circle cx="5.5" cy="5.5" r="1" />
            <path d="M14 10L10.5 7L3 13" />
            <path d="M12 13L8 9L5 12" />
          </svg>
        );
      case ChabotOutputModality.Video:
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="2" y="2" width="12" height="12" rx="1" />
            <path d="M2 6L14 6" />
            <path d="M5 3L6.5 6" />
            <path d="M8 3L9.5 6" />
            <path d="M11 3L12.5 6" />
            <path d="M6.5 8L10 9.75L6.5 11.5Z" />
          </svg>
        );
      default:
        return;
    }
  }, [outputModality]);

  /* Update this component to support video files */
  return (
    <SpaceBetween direction="vertical" size="l">
      <Box>
        <div>
          {imageDialogVisible && (
            <FileDialog
              sessionId={props.session.id}
              modality={ChabotInputModality.Image}
              header="Add images to your message"
              hint=".png, .jpg, .jpeg. Max 3.75MB."
              maxSize={3.75}
              allowedTypes={["image/png", "image/jpg", "image/jpeg"]}
              hideDialogs={() => {
                setImageDialogVisible(false);
                setDocumentDialogVisible(false);
              }}
              cancel={() => {
                props.setConfiguration({
                  ...props.configuration,
                  images: [],
                });
                setImages([]);
              }}
              configuration={props.configuration}
              setConfiguration={props.setConfiguration}
            />
          )}
          {videoDialogVisible && (
            <FileDialog
              sessionId={props.session.id}
              modality={ChabotInputModality.Video}
              header="Add videos to your message"
              hint="video/mp4. Max 10MB."
              maxSize={10}
              allowedTypes={["video/mp4"]}
              hideDialogs={() => {
                setImageDialogVisible(false);
                setDocumentDialogVisible(false);
                setVideoDialogVisible(false);
              }}
              cancel={() => {
                props.setConfiguration({
                  ...props.configuration,
                  videos: [],
                });
                setVideos([]);
              }}
              configuration={props.configuration}
              setConfiguration={props.setConfiguration}
            />
          )}
          {documentDialogVisible && (
            <FileDialog
              sessionId={props.session.id}
              modality={ChabotInputModality.Document}
              header="Add documents to your message"
              hint=".pdf, .csv, .doc, .docx, .xls, .xlsx, .html,. txt, .md. Max 4.5MB."
              allowedTypes={[
                "application/pdf",
                "text/csv",
                "application/msword",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "application/vnd.ms-excel",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "text/html",
                "text/plain",
                "text/markdown",
              ]}
              maxSize={4.5}
              hideDialogs={() => {
                setImageDialogVisible(false);
                setDocumentDialogVisible(false);
              }}
              cancel={() => {
                props.setConfiguration({
                  ...props.configuration,
                  documents: [],
                });
                setDocuments([]);
              }}
              configuration={props.configuration}
              setConfiguration={props.setConfiguration}
            />
          )}
          <Box className={styles.prompt_input_wrapper}>
            <PromptInput
              data-locator="prompt-input"
              value={state.value}
              placeholder={
                listening
                  ? "Listening..."
                  : props.running
                  ? "Generating a response"
                  : "Send a message"
              }
              actionButtonAriaLabel="Send"
              maxRows={6}
              minRows={1}
              autoFocus={true}
              disabled={props.running}
              onChange={(e) =>
                setState((state) => ({ ...state, value: e.detail.value }))
              }
              onAction={handleSendMessage}
              actionButtonIconName="send"
              disableSecondaryActionsPaddings
              onKeyUp={(e) => {
                if (e.detail.key === "ArrowUp") {
                  const messages = props.messageHistory.filter(
                    (i) => i.type === ChatBotMessageType.Human
                  );
                  if (state.value.length === 0 && messages.length > 0) {
                    // Set previous message if empty and key press up
                    setState((state) => ({
                      ...state,
                      value: messages[messages.length - 1].content,
                    }));
                  }
                }
              }}
              secondaryActions={
                <Box padding={{ left: "xxs", top: "xs" }}>
                  <ButtonGroup
                    ariaLabel="Chat actions"
                    items={secondaryActions}
                    variant="icon"
                    onItemClick={(item) => {
                      if (item.detail.id === "images") {
                        setImageDialogVisible(true);
                        setDocumentDialogVisible(false);
                        setVideoDialogVisible(false);
                      }
                      if (item.detail.id === "documents") {
                        setImageDialogVisible(false);
                        setDocumentDialogVisible(true);
                        setVideoDialogVisible(false);
                      }
                      if (item.detail.id === "videos") {
                        setVideoDialogVisible(true);
                        setImageDialogVisible(false);
                        setDocumentDialogVisible(false);
                      }
                      if (item.detail.id === "record") {
                        listening
                          ? SpeechRecognition.stopListening()
                          : SpeechRecognition.startListening();
                      }
                    }}
                  />
                </Box>
              }
              secondaryContent={
                filesBlob.length > 0 && (
                  <FileTokenGroup
                    items={filesBlob.map((file) => ({ file }))}
                    onDismiss={({ detail }) =>
                      setFilesBlob((files) =>
                        files.filter((_, index) => index !== detail.fileIndex)
                      )
                    }
                    alignment="horizontal"
                    i18nStrings={{
                      removeFileAriaLabel: (e) => `Remove file ${e + 1}`,
                      limitShowFewer: "Show fewer files",
                      limitShowMore: "Show more files",
                      errorIconAriaLabel: "Error",
                      warningIconAriaLabel: "Warning",
                    }}
                    readOnly
                    showFileSize
                    showFileThumbnail
                  />
                )
              }
              disableActionButton={
                readyState !== ReadyState.OPEN ||
                (!state.models?.length && !props.applicationId) ||
                (!state.selectedModel && !props.applicationId) ||
                props.running ||
                state.value.trim().length === 0 ||
                props.session.loading
              }
            />
            <span className={styles.icon}>{outputModalityIcon}</span>
          </Box>
        </div>
      </Box>
      {!props.applicationId && (
        <Box>
          <div className={styles.input_controls}>
            <div
              className={
                appContext?.config.rag_enabled
                  ? styles.input_controls_selects_2
                  : styles.input_controls_selects_1
              }
            >
              <Select
                data-locator="select-model"
                disabled={props.running}
                statusType={state.modelsStatus}
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
                  props.setConfiguration({
                    ...props.configuration,
                    filesBlob: {
                      images: [],
                      documents: [],
                      videos: [],
                    },
                    images: [],
                    documents: [],
                    videos: [],
                  });
                  setImages([]);
                  setDocuments([]);
                  setVideos([]);
                  setFilesBlob([]);
                  if (detail.selectedOption?.value) {
                    StorageHelper.setSelectedLLM(detail.selectedOption.value);
                  }
                }}
                options={modelsOptions}
              />
              {appContext?.config.rag_enabled && (
                <Select
                  disabled={
                    props.running ||
                    !state.selectedModelMetadata?.ragSupported ||
                    isMediaGenerationModel(outputModality)
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
              <SpaceBetween
                direction="horizontal"
                size="xxs"
                alignItems="center"
              >
                <div style={{ paddingTop: "1px" }}>
                  <ConfigDialog
                    sessionId={props.session.id}
                    visible={configDialogVisible}
                    setVisible={setConfigDialogVisible}
                    configuration={props.configuration}
                    setConfiguration={props.setConfiguration}
                    outputModality={outputModality}
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
                  {readyState === ReadyState.OPEN
                    ? "Connected"
                    : connectionStatus}
                </StatusIndicator>
              </SpaceBetween>
            </div>
          </div>
        </Box>
      )}
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

function getSelectedModelOption(
  models: Model[],
  selectedModel?: string
): SelectProps.Option | null {
  let selectedModelOption: SelectProps.Option | null = null;
  const savedModel = selectedModel ?? StorageHelper.getSelectedLLM();

  if (savedModel) {
    const savedModelDetails = OptionsHelper.parseValue(savedModel);
    const targetModel = models.find(
      (m) =>
        m.name === savedModelDetails.name &&
        m.provider === savedModelDetails.provider
    );

    if (targetModel) {
      const groups = OptionsHelper.getSelectOptionGroups([targetModel]).filter(
        (i) => (i as SelectProps.OptionGroup).options
      ) as SelectProps.OptionGroup[];
      selectedModelOption =
        groups.length > 0 && groups[0].options.length > 0
          ? groups[0].options[0]
          : null;
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
      const groups = OptionsHelper.getSelectOptionGroups([candidate]).filter(
        (i) => (i as SelectProps.OptionGroup).options
      ) as SelectProps.OptionGroup[];
      selectedModelOption =
        groups.length > 0 && groups[0].options.length > 0
          ? groups[0].options[0]
          : null;
    }
  }

  return selectedModelOption;
}
