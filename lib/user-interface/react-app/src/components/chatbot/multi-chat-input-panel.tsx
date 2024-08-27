import {
  Button,
  SpaceBetween,
  Icon,
  PromptInput,
  Box,
} from "@cloudscape-design/components";
import { useEffect, useState } from "react";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";
import styles from "../../styles/chat.module.scss";
import { LoadingBar } from "@cloudscape-design/chat-components";

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
        {props.running ? (
          <div aria-live="polite">
            <Box
              margin={{ bottom: "xs", left: "l" }}
              color="text-body-secondary"
            >
              Generating a response
            </Box>
            <LoadingBar variant="gen-ai" />
          </div>
        ) : (
          <PromptInput
            value={value}
            placeholder={listening ? "Listening..." : "Send a message"}
            maxRows={6}
            minRows={1}
            onChange={({ detail }) => setValue(detail.value)}
            onAction={() => {
              props.onSendMessage(value);
              setValue("");
            }}
            actionButtonIconName="send"
            disableActionButton={!props.enabled || value.trim().length === 0}
          />
        )}
      </div>
    </SpaceBetween>
  );
}
