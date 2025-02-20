import {
  SpaceBetween,
  PromptInput,
  ButtonGroup,
  Box,
  ButtonGroupProps,
} from "@cloudscape-design/components";
import { useEffect, useState } from "react";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";

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

  const secondaryActions: ButtonGroupProps.ItemOrGroup[] = [
    {
      type: "icon-button",
      id: "record",
      iconName: listening ? "microphone-off" : "microphone",
      text: "Record",
      disabled: props.running || !browserSupportsSpeechRecognition,
    },
  ];

  return (
    <SpaceBetween direction="vertical" size="xs">
      <div
        style={{ display: "flex", justifyContent: "end", paddingRight: "4px" }}
      ></div>
      <div>
        <PromptInput
          data-locator="prompt-input"
          value={value}
          placeholder={
            listening
              ? "Listening..."
              : props.running
                ? "Generating a response"
                : "Send a message"
          }
          maxRows={6}
          minRows={1}
          autoFocus={true}
          disabled={props.running || !props.enabled}
          onChange={({ detail }) => setValue(detail.value)}
          onAction={() => {
            props.onSendMessage(value);
            setValue("");
          }}
          actionButtonIconName="send"
          actionButtonAriaLabel="Send"
          disableSecondaryActionsPaddings
          secondaryActions={
            <Box padding={{ left: "xxs", top: "xs" }}>
              <ButtonGroup
                ariaLabel="Chat actions"
                items={secondaryActions}
                variant="icon"
                onItemClick={(item) => {
                  if (item.detail.id === "record") {
                    listening
                      ? SpeechRecognition.stopListening()
                      : SpeechRecognition.startListening();
                  }
                }}
              />
            </Box>
          }
          disableActionButton={!props.enabled || value.trim().length === 0}
        />
      </div>
    </SpaceBetween>
  );
}
