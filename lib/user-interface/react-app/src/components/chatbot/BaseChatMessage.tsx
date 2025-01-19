import {
  ExpandableSection,
  ButtonGroup,
  ButtonGroupProps,
  StatusIndicator,
} from "@cloudscape-design/components";
import { ReactElement, useState } from "react";
import { Avatar, ChatBubble } from "@cloudscape-design/chat-components";

export function BaseChatMessage({
  role,
  waiting,
  name,
  avatarElement,
  children,
  expandableContent,
  onFeedback,
  onCopy,
}: {
  readonly role: "ai" | "human";
  readonly waiting?: boolean;
  readonly name?: string;
  readonly avatarElement?: ReactElement;
  readonly children?: ReactElement;
  readonly expandableContent?: ReactElement;
  readonly onFeedback: (thumb: "up" | "down" | undefined) => void;
  readonly onCopy?: () => void;
}) {
  const [thumb, setThumb] = useState<"up" | "down" | undefined>(undefined);

  const buttonGroupItems: ButtonGroupProps.Group[] = [];
  buttonGroupItems.push({
    type: "group",
    text: "Feedback",
    items: [
      {
        type: "icon-button",
        id: "thumbs-up",
        iconName: thumb == "up" ? "thumbs-up-filled" : "thumbs-up",
        text: "Thumbs Up",
      },
      {
        type: "icon-button",
        id: "thumbs-down",
        iconName: thumb == "down" ? "thumbs-down-filled" : "thumbs-down",
        text: "Thumbs Down",
      },
    ],
  });
  const copyGroup: ButtonGroupProps.Group = {
    type: "group",
    text: "Actions",
    items: [
      {
        type: "icon-button",
        id: "copy",
        iconName: "copy",
        text: "Copy",
        popoverFeedback: (
          <StatusIndicator type="success">Message copied</StatusIndicator>
        ),
      },
    ],
  };
  buttonGroupItems.push(copyGroup);

  return (
    <ChatBubble
      ariaLabel={role}
      type={role === "ai" ? "incoming" : "outgoing"}
      showLoadingBar={waiting}
      actions={
        role == "ai" && !waiting ? (
          <ButtonGroup
            ariaLabel="Chat actions"
            variant="icon"
            onItemClick={(e) => {
              if (e.detail.id === "thumbs-up") {
                if (thumb === "up") {
                  setThumb(undefined);
                } else {
                  setThumb("up");
                  onFeedback("up");
                }
              } else if (e.detail.id === "thumbs-down") {
                if (thumb === "down") {
                  setThumb(undefined);
                } else {
                  setThumb("down");
                  onFeedback("down");
                }
              } else if (e.detail.id === "copy") {
                onCopy?.();
              }
            }}
            items={buttonGroupItems}
          />
        ) : undefined
      }
      avatar={
        role === "ai" ? (
          <Avatar
            ariaLabel="Assistant"
            color="gen-ai"
            iconName="gen-ai"
            iconSvg={avatarElement}
            loading={waiting ?? false}
          />
        ) : (
          <Avatar
            ariaLabel={name!}
            initials={name?.substring(0, 2)}
            iconSvg={avatarElement}
          />
        )
      }
    >
      {children}
      {!waiting && expandableContent && (
        <ExpandableSection variant="footer" headerText="Metadata">
          {expandableContent}
        </ExpandableSection>
      )}
    </ChatBubble>
  );
}
