import {
  Button,
  SpaceBetween,
  Container,
  Spinner,
  Icon,
} from "@cloudscape-design/components";
import { useEffect, useState } from "react";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";
import TextareaAutosize from "react-textarea-autosize";
import styles from "../../styles/chat.module.scss";

export interface MultiChatInputPanelProps {
  running: boolean;
  enabled: boolean;
  onSendMessage: (msg: string) => void;
}

export abstract class ChatScrollState {
  static userHasScrolled = false;
  static skipNextScrollEvent = false;
  static skipNextHistoryUpdate = false;
}

export default function MultiChatInputPanel(props: MultiChatInputPanelProps) {
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

  return (
    <SpaceBetween direction="vertical" size="xs">
      <div
        style={{ display: "flex", justifyContent: "end", paddingRight: "4px" }}
      ></div>
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
    </SpaceBetween>
  );
}
