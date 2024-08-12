import {
  ExpandableSection,
  ButtonGroup,
  ButtonGroupProps,
  Box,
  StatusIndicator,
} from "@cloudscape-design/components";
import { ReactElement, useEffect, useMemo, useState } from "react";
import { Avatar } from "@cloudscape-design/chat-components";

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
  readonly onFeedback?: (thumb: "up" | "down" | undefined) => void;
  readonly onCopy?: () => void;
}) {
  const [thumb, setThumb] = useState<"up" | "down" | undefined>(undefined);

  const buttonGroupItems = useMemo(() => {
    const bg: ButtonGroupProps.Group[] = [];
    if (onFeedback && role === "ai") {
      bg.push({
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
    }

    if (onCopy) {
      bg.push({
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
      });
    }
    return bg;
  }, [thumb, role, onCopy, onFeedback]);

  useEffect(() => {
    if (onFeedback) onFeedback(thumb);
  }, [thumb, onFeedback]);

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
        {role === "ai" ? (
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
            loading={waiting ?? false}
          />
        )}
      </div>

      <div
        style={{
          flexDirection: "column",
          flexGrow: 1,
          backgroundColor: role === "ai" ? "#F1F1F1" : "white",
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
          {children}
        </div>
        {(onCopy || onFeedback) && (
          <Box float="right">
            <ButtonGroup
              variant="icon"
              items={buttonGroupItems}
              onItemClick={(e) => {
                if (e.detail.id === "thumbs-up") {
                  if (thumb === "up") {
                    setThumb(undefined);
                  } else setThumb("up");
                } else if (e.detail.id === "thumbs-down") {
                  if (thumb === "down") {
                    setThumb(undefined);
                  } else setThumb("down");
                } else if (e.detail.id === "copy") {
                  onCopy?.();
                }
              }}
            />
          </Box>
        )}
        {!waiting && expandableContent && (
          <ExpandableSection variant="footer" headerText="Metadata">
            {expandableContent}
          </ExpandableSection>
        )}
      </div>
    </div>
  );
}
