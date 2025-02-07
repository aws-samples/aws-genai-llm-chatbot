import { SessionFile } from "./types";
import styles from "../../styles/chat.module.scss";

interface ChatMessageMediaDisplayProps {
  images: SessionFile[];
  documents: SessionFile[];
  videos: SessionFile[];
  isAIMessage?: boolean;
}

export function ChatMessageMediaDisplay({
  images,
  documents,
  videos,
  isAIMessage = false,
}: ChatMessageMediaDisplayProps) {
  if (
    [images, documents, videos].every((mediaArray) => mediaArray.length === 0)
  )
    return null;

  const filesContainerStyle = isAIMessage ? undefined : { marginLeft: "5px" };
  return (
    <div className={styles.filesContainer} style={filesContainerStyle}>
      {documents.length > 0 && (
        <>
          {documents.map((file, idx) => (
            <a
              key={idx}
              href={file.url as string}
              target="_blank"
              rel="noreferrer"
              style={{ marginRight: "0.5em" }}
            >
              Document {idx + 1}
            </a>
          ))}
        </>
      )}
      {images.length > 0 && (
        <>
          {images.map((file, idx) => (
            <a
              key={idx}
              href={file.url as string}
              target="_blank"
              rel="noreferrer"
              style={
                isAIMessage ? { marginLeft: "5px", marginRight: "5px" } : {}
              }
            >
              <img
                src={file.url as string}
                className={styles.img_chabot_message}
                alt={
                  isAIMessage ? "AI generated content" : "User uploaded content"
                }
              />
            </a>
          ))}
        </>
      )}
      {videos.length > 0 && (
        <>
          {videos.map((file, idx) => (
            <video
              key={idx}
              muted={true}
              loop={true}
              autoPlay={true}
              className={styles.video_chabot_message}
              controls
              style={{ maxHeight: 240 }}
            >
              <source src={file.url as string} />
              Your browser does not support video playback.
            </video>
          ))}
        </>
      )}
    </div>
  );
}
