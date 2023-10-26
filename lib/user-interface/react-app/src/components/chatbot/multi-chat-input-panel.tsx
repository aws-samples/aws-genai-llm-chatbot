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
import { LoadingStatus, WorkspaceItem } from "../../common/types";

export interface MultiChatInputPanelProps {
  running: boolean;
  readyState: ReadyState;
  onSendMessage: (msg: string) => void;
  enabled: boolean;
  workspaces: WorkspaceItem[];
  selectedWorkspace?: SelectProps.Option;
  workspacesStatus: LoadingStatus;
  workspaceDefaultOptions: SelectProps.Option[];
  showMetadata?: boolean;
  onShowMetadataChange: (showMetadata: boolean) => void;
  onWorkspaceChange: (workspace: SelectProps.Option | null) => void;
}

export abstract class ChatScrollState {
  static userHasScrolled = false;
  static skipNextScrollEvent = false;
  static skipNextHistoryUpdate = false;
}

export default function MultiChatInputPanel(props: MultiChatInputPanelProps) {
  const appContext = useContext(AppContext);
  const navigate = useNavigate();
  const { transcript, listening, browserSupportsSpeechRecognition } =
    useSpeechRecognition();
  const [value, setValue] = useState<string>("");

  useEffect(() => {
    if (transcript) {
      setValue(transcript);
    }
  }, [transcript]);

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
    ...props.workspaceDefaultOptions,
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
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (!props.enabled) return;
              if (e.key == "Enter" && !e.shiftKey) {
                e.preventDefault();
                props.onSendMessage(value);
                setValue("");
              }
            }}
            value={value}
            placeholder={listening ? "Listening..." : "Send a message"}
          />
          <div style={{ marginLeft: "8px" }}>
            <Button
              disabled={!props.enabled || value.trim().length === 0}
              onClick={() => {
                props.onSendMessage(value);
                setValue("");
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
              statusType={props.workspacesStatus}
              placeholder="Select a workspace (RAG data source)"
              filteringType="auto"
              selectedOption={props.selectedWorkspace ?? null}
              options={workspaceOptions}
              onChange={({ detail }) => {
                if (detail.selectedOption?.value === "__create__") {
                  navigate("/rag/workspaces/create");
                } else {
                  props.onWorkspaceChange(detail.selectedOption);
                }
              }}
              empty={"No Workspaces available"}
            />
          )}
        </div>
        <div className={styles.input_controls_right}>
          <SpaceBetween direction="horizontal" size="s" alignItems="center">
            <Toggle
              checked={props.showMetadata ?? false}
              onChange={({ detail }) =>
                props.onShowMetadataChange(detail.checked)
              }
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
