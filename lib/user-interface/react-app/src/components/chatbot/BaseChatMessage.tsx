import {
  Button,
  ExpandableSection,
  Popover,
  SpaceBetween,
} from "@cloudscape-design/components";
import { ReactElement, useState } from "react";
import styles from "../../styles/chat.module.scss";
import { CopyWithPopoverButton } from "./CopyButton";

function Avatar(props: {
  readonly name?: string;
  readonly icon?: string;
  readonly role: "ai" | "human";
  readonly waiting?: boolean;
}) {
  return (
    <div
      style={{
        display: "block",
        marginRight: "1em",
        width: "40px",
        height: "40px",
        minWidth: "40px",
        minHeight: "40px",
        alignContent: "start",
        borderRadius: "50%",
        background:
          props.role === "ai"
            ? "linear-gradient(300deg, rgb(52,20,120), rgb(118,72,250), rgb(62,141,255))"
            : "#545b64",
      }}
    >
      {props.waiting ? (
        <div className={styles.wave}>
          <span className={styles.dot}></span>
          <span className={styles.dot}></span>
          <span className={styles.dot}></span>
        </div>
      ) : (
        <>
          {props?.name && (
            <div
              style={{
                display: "block",
                textAlign: "center",
                position: "relative",
                color: "#FFFFFF",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
              }}
            >
              <Popover
                content={props.name}
                dismissButton={false}
                position="top"
                size="small"
              >
                <h3>{props.name[0].toUpperCase()}</h3>
              </Popover>
            </div>
          )}
        </>
      )}
    </div>
  );
}

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
        name={props.role === "ai" ? "Assistant" : "Human"}
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
