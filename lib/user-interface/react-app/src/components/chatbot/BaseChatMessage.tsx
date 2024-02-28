import {
  Button,
  ExpandableSection,
  SpaceBetween,
} from "@cloudscape-design/components";
import { ReactElement, useState } from "react";
import styles from "../../styles/chat.module.scss";
import { CopyWithPopoverButton } from "./CopyButton";

function Avatar(props: { readonly name: string; readonly icon?: string }) {
  return (
    <h3
      style={{
        display: "block",
        textAlign: "center",

        position: "relative",
        color: "#FFFFFF",
        top: "0%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      }}
    >
      {props.name}
    </h3>
  );
}

export function BaseChatMessage(props: {
  readonly role: "ai" | "human";
  readonly waiting?: boolean;
  readonly children?: ReactElement;
  readonly expandableContent?: ReactElement;
  readonly onThumbsUp?: () => void;
  readonly onThumbsDown?: () => void;
  readonly onCopy?: () => void;
}) {
  const [thumbs, setThumbs] = useState<"up" | "down" | undefined>(undefined);
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
          background: props.role === "ai" ? "#341478" : "#7638FA",
        }}
      >
        {props.role === "ai" ? (
          props.waiting ? (
            <div className={styles.wave}>
              <span className={styles.dot}></span>
              <span className={styles.dot}></span>
              <span className={styles.dot}></span>
            </div>
          ) : (
            <Avatar name="A" />
          )
        ) : (
          <Avatar name="H" />
        )}
      </div>

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
        {(props.onCopy || props.onThumbsDown || props.onThumbsUp) && (
          <div className={styles.btn_chabot_message_copy}>
            <SpaceBetween direction="horizontal" size="xxs">
              {props.role === "ai" && props.onThumbsUp && thumbs != "down" && (
                <Button
                  variant="icon"
                  iconName={thumbs == "up" ? "thumbs-up-filled" : "thumbs-up"}
                  disabled={props.waiting}
                  onClick={() => {
                    props.onThumbsUp!();
                    thumbs != "up" ? setThumbs("up") : setThumbs(undefined);
                  }}
                />
              )}
              {props.role === "ai" && props.onThumbsDown && thumbs != "up" && (
                <div style={{ fontSize: "0.9em" }}>
                  <Button
                    variant="icon"
                    disabled={props.waiting}
                    iconName={
                      thumbs == "down" ? "thumbs-down-filled" : "thumbs-down"
                    }
                    onClick={() => {
                      props.onThumbsDown!();
                      thumbs != "down"
                        ? setThumbs("down")
                        : setThumbs(undefined);
                    }}
                  />
                  {thumbs === "down" ? "Not helpful" : null}
                </div>
              )}
              {props.role == "ai" &&
                (props.onThumbsDown || props.onThumbsUp) && (
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
