import {
  ExpandableSection,
  ButtonGroup,
  ButtonGroupProps,
  Box,
  StatusIndicator,
} from "@cloudscape-design/components";
import { ReactElement, useEffect, useState } from "react";
import { Avatar } from "@cloudscape-design/chat-components";

export function BaseChatMessage(props: {
  readonly role: "ai" | "human";
  readonly waiting?: boolean;
  readonly name?: string;
  readonly avatarElement?: ReactElement;
  readonly children?: ReactElement;
  readonly expandableContent?: ReactElement;
  readonly onFeedback?: (thumb: "up" | "down" | undefined) => void;
  readonly onCopy?: () => void;
}) {
  const [thumb, setThumbs] = useState<"up" | "down" | undefined>(undefined);

  const buttonGroupItems: ButtonGroupProps.IconButton[] = [];

  if (props.onFeedback) {
    buttonGroupItems.push({
      type: "icon-button",
      id: "thumbs-up",
      iconName: thumb == "up" ? "thumbs-up-filled" : "thumbs-up",
      text: "Thumbs Up",
    });
    buttonGroupItems.push({
      type: "icon-button",
      id: "thumbs-down",
      iconName: thumb == "down" ? "thumbs-down-filled" : "thumbs-down",
      text: "Thumbs Down",
    });
  }

  if (props.onCopy) {
    buttonGroupItems.push({
      type: "icon-button",
      id: "copy",
      iconName: "copy",
      text: "Copy",
      popoverFeedback: (
        <StatusIndicator type="success">Message copied</StatusIndicator>
      ),
    });
  }

  useEffect(() => {
    buttonGroupItems[0].iconName =
      thumb == "up" ? "thumbs-up-filled" : "thumbs-up";
    buttonGroupItems[1].iconName =
      thumb == "down" ? "thumbs-down-filled" : "thumbs-down";
    if (props.onFeedback) props.onFeedback(thumb);
  }, [thumb]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        flexWrap: "nowrap",
        justifyContent: "left",
        alignItems: "flex-start",
      }}
    >
      <div style={{ marginTop: "0.5em" }}>
        {props.role === "ai" ? (
          <Avatar
            ariaLabel="Assistant"
            color="gen-ai"
            iconName="gen-ai"
            iconSvg={props.avatarElement}
            loading={props.waiting ?? false}
          />
        ) : (
          <Avatar
            ariaLabel={props.name!}
            initials={props.name?.substring(0, 2)}
            iconSvg={props.avatarElement}
            loading={props.waiting ?? false}
          />
        )}
      </div>

      <div
        style={{
          flexDirection: "column",
          flexGrow: 1,
          backgroundColor: props.role === "ai" ? "#F1F1F1" : "white",
          borderRadius: "0.4em",
          padding: "0.5em",
          marginLeft: "0.5em",
        }}
      >
        <div
          style={{
            flexDirection: "row",
            flexGrow: "2",
            justifyContent: "flex-start",
            alignItems: "flex-start",
          }}
        >
          {props.children}
        </div>
        {(props.onCopy || props.onFeedback) && (
          <Box float="right">
            <ButtonGroup
              variant="icon"
              items={buttonGroupItems}
              onItemClick={(e) => {
                if (e.detail.id === "thumbs-up") {
                  if (thumb === "up") {
                    setThumbs(undefined);
                  } else setThumbs("up");
                } else if (e.detail.id === "thumbs-down") {
                  if (thumb === "down") {
                    setThumbs(undefined);
                  } else setThumbs("down");
                } else if (e.detail.id === "copy") {
                  props.onCopy?.();
                }
              }}
            />
          </Box>
        )}
        {!props.waiting && props.expandableContent && (
          <ExpandableSection variant="footer" headerText="Metadata">
            {props.expandableContent}
          </ExpandableSection>
        )}
      </div>
    </div>
  );
}
