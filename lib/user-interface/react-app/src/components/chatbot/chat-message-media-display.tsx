import { MediaFile, ChabotOutputModality, ChabotInputModality } from "./types";
import styles from "../../styles/chat.module.scss";

interface ChatMessageMediaDisplayProps {
  files: MediaFile[];
  isAIMessage?: boolean;
}

export function ChatMessageMediaDisplay({
  files,
  isAIMessage = false,
}: ChatMessageMediaDisplayProps) {
  if (files.length === 0) return null;

  return (
    <div className={styles.filesContainer}>
      {files.map((file: MediaFile) => (
        <div key={file.key}>
          {(isAIMessage && file.type === ChabotOutputModality.Image) ||
          (!isAIMessage && file.type === ChabotInputModality.Image) ? (
            <a
              href={file.url as string}
              target="_blank"
              rel="noreferrer"
              style={{ marginLeft: "5px", marginRight: "5px" }}
            >
              <img
                src={file.url as string}
                className={
                  isAIMessage
                    ? styles.img_chabot_message_ai
                    : styles.img_chabot_message
                }
                alt={
                  isAIMessage ? "AI generated content" : "User uploaded content"
                }
              />
            </a>
          ) : (
            <video
              muted={true}
              loop={true}
              autoPlay={true}
              className={styles.video_chabot_message}
              controls
            >
              <source src={file.url as string} />
              Your browser does not support video playback.
            </video>
          )}
        </div>
      ))}
    </div>
  );
}
