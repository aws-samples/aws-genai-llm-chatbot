import {
  Button,
  ExpandableSection,
  SpaceBetween,
} from "@cloudscape-design/components";
import { ReactElement, useState } from "react";
import styles from "../../styles/chat.module.scss";
import { CopyWithPopoverButton } from "./CopyButton";
import { Avatar } from "./Avatar";

export function BaseChatMessage(props: {
  readonly role: "ai" | "human";
  readonly waiting?: boolean;
  readonly children?: ReactElement;
  readonly expandableContent?: ReactElement;
  readonly onFeedback?: (thumb: "up" | "down") => void;
  readonly onCopy?: () => void;
}) {
  const [thumb, setThumbs] = useState<"up" | "down" | undefined>(undefined);
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
      <Avatar
        name={props.role === "human" ? "Human" : undefined}
        content={
          props.role === "ai" ? (
            <svg
              viewBox="0 0 16 16"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
            >
              <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
              <g
                id="SVGRepo_tracerCarrier"
                stroke-linecap="round"
                stroke-linejoin="round"
              ></g>
              <g id="SVGRepo_iconCarrier">
                <path
                  fill="#FFFFFF"
                  fill-rule="evenodd"
                  d="M.5 2.75a2.25 2.25 0 114.28.97l1.345 1.344.284-.284a2.25 2.25 0 013.182 0l.284.284 1.344-1.344a2.25 2.25 0 111.06 1.06l-1.343 1.345.284.284a2.25 2.25 0 010 3.182l-.284.284 1.344 1.344a2.25 2.25 0 11-1.06 1.06l-1.345-1.343-.284.284a2.25 2.25 0 01-3.182 0l-.284-.284-1.344 1.344a2.25 2.25 0 11-1.06-1.06l1.343-1.345-.284-.284a2.25 2.25 0 010-3.182l.284-.284L3.72 4.781A2.25 2.25 0 01.5 2.75zM2.75 2a.75.75 0 100 1.5.75.75 0 000-1.5zm0 10.5a.75.75 0 100 1.5.75.75 0 000-1.5zm9.75.75a.75.75 0 111.5 0 .75.75 0 01-1.5 0zM13.25 2a.75.75 0 100 1.5.75.75 0 000-1.5zM7.47 5.841a.75.75 0 011.06 0L10.16 7.47a.75.75 0 010 1.06L8.53 10.16a.75.75 0 01-1.06 0L5.84 8.53a.75.75 0 010-1.06L7.47 5.84z"
                  clip-rule="evenodd"
                ></path>
              </g>
            </svg>
          ) : undefined
        }
        waiting={props.waiting}
        role={props.role}
      />

      <div
        style={{
          flexDirection: "column",
          flexGrow: 1,
          backgroundColor: props.role === "ai" ? "#F1F1F1" : "white",
          borderRadius: "0.1em",
          padding: "0.5em",
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
          <div className={styles.btn_chabot_message_copy}>
            <SpaceBetween direction="horizontal" size="xxs">
              {props.role === "ai" && props.onFeedback && (
                <>
                  {thumb != "down" && (
                    <Button
                      variant="icon"
                      iconName={
                        thumb == "up" ? "thumbs-up-filled" : "thumbs-up"
                      }
                      disabled={props.waiting}
                      onClick={() => {
                        props.onFeedback!("up");
                        thumb != "up" ? setThumbs("up") : setThumbs(undefined);
                      }}
                    />
                  )}
                  {thumb != "up" && (
                    <div style={{ fontSize: "0.9em" }}>
                      <Button
                        variant="icon"
                        disabled={props.waiting}
                        iconName={
                          thumb == "down" ? "thumbs-down-filled" : "thumbs-down"
                        }
                        onClick={() => {
                          props.onFeedback!("down");
                          thumb != "down"
                            ? setThumbs("down")
                            : setThumbs(undefined);
                        }}
                      />
                      {thumb === "down" ? "Not helpful" : null}
                    </div>
                  )}
                  <div
                    style={{
                      borderRightColor: "#D0D0D0",
                      borderRightStyle: "solid",
                      borderRightWidth: "1px",
                      height: "80%",
                      marginTop: "auto",
                      marginBottom: "auto",
                    }}
                  />
                </>
              )}
              {props.onCopy ? (
                <CopyWithPopoverButton
                  disabled={props.waiting}
                  onCopy={props.onCopy}
                />
              ) : (
                <></>
              )}
            </SpaceBetween>
          </div>
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
