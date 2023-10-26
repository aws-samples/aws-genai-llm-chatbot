import {
  Button,
  Select,
  SpaceBetween,
  StatusIndicator,
  SelectProps,
  Container,
  Spinner,
  Icon,
  Toggle,
} from "@cloudscape-design/components";
import { useContext, useEffect, useState } from "react";
import { ReadyState } from "react-use-websocket";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";

import { AppContext } from "../../common/app-context";
import TextareaAutosize from "react-textarea-autosize";
import { OptionsHelper } from "../../common/helpers/options-helper";
import { useNavigate } from "react-router-dom";
import styles from "../../styles/chat.module.scss";
import { WorkspaceItem } from "../../common/types";
import { ChatInputState } from "./types";

export interface MultiChatInputPanelProps {
  running: boolean;
  readyState: ReadyState;
  onSendMessage: (msg: string) => void;
  enabled: boolean;
  workspaces: WorkspaceItem[];
  selectedWorkspace?: SelectProps.Option;
  showMetadata?: boolean;
  onChange: (showMetadata: boolean, workspace: SelectProps.Option | null) => void;
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

export default function MultiChatInputPanel(props: MultiChatInputPanelProps) {
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

  useEffect(() => {
    if (transcript) {
      setState((state) => ({ ...state, value: transcript }));
    }
  }, [transcript]);

  useEffect(() => {
    if (!appContext) return;
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

  const connectionStatus = {
    [ReadyState.CONNECTING]: "Connecting",
    [ReadyState.OPEN]: "Open",
    [ReadyState.CLOSING]: "Closing",
    [ReadyState.CLOSED]: "Closed",
    [ReadyState.UNINSTANTIATED]: "Uninstantiated",
  }[props.readyState];

  const workspaceOptions = [
    ...workspaceDefaultOptions,
    ...OptionsHelper.getSelectOptions(props.workspaces || []),
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
                props.onSendMessage(state.value);
                setState((state) => ({ ...state, value: "" }));
              }
            }}
            value={state.value}
            placeholder={listening ? "Listening..." : "Send a message"}
          />
          <div style={{ marginLeft: "8px" }}>
            <Button
              disabled={!props.enabled || state.value.trim().length === 0}
              onClick={() => {
                props.onSendMessage(state.value);
                setState((state) => ({ ...state, value: "" }));
              }}
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
          {appContext?.config.rag_enabled && true && (
            <Select
              disabled={props.running}
              loadingText="Loading workspaces (might take few seconds)..."
              statusType={state.workspacesStatus}
              placeholder="Select a workspace (RAG data source)"
              filteringType="auto"
              selectedOption={props.selectedWorkspace ?? null}
              options={workspaceOptions}
              onChange={({ detail }) => {
                if (detail.selectedOption?.value === "__create__") {
                  navigate("/rag/workspaces/create");
                } else {
                  props.onChange(props.showMetadata ?? false, detail.selectedOption);
                }
              }}
              empty={"No Workspaces available"}
            />
          )}
        </div>
        <div className={styles.input_controls_right}>
          <SpaceBetween direction="horizontal" size="xxs" alignItems="center">
            <Toggle
              checked={props.showMetadata ?? false}
              onChange={({ detail }) => props.onChange(detail.checked, state.selectedWorkspace)}
            >
              Show Metadata
            </Toggle>
            <StatusIndicator
              type={
                props.readyState === ReadyState.OPEN
                  ? "success"
                  : props.readyState === ReadyState.CONNECTING ||
                    props.readyState === ReadyState.UNINSTANTIATED
                  ? "in-progress"
                  : "error"
              }
            >
              {props.readyState === ReadyState.OPEN
                ? "Connected"
                : connectionStatus}
            </StatusIndicator>
          </SpaceBetween>
        </div>
      </div>
    </SpaceBetween>
  );
}
