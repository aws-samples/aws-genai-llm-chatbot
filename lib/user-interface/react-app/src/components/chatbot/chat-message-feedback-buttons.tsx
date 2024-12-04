import { Button } from "@cloudscape-design/components";
import styles from "../../styles/chat.module.scss";

interface ChatMessageFeedbackButtonsProps {
  selectedIcon: 1 | 0 | null;
  onThumbsUp: () => void;
  onThumbsDown: () => void;
  setSelectedIcon: (value: 1 | 0) => void;
}

export function ChatMessageFeedbackButtons({
  selectedIcon,
  onThumbsUp,
  onThumbsDown,
  setSelectedIcon,
}: ChatMessageFeedbackButtonsProps) {
  return (
    <div className={styles.thumbsContainer}>
      {(selectedIcon === 1 || selectedIcon === null) && (
        <Button
          variant="icon"
          iconName={selectedIcon === 1 ? "thumbs-up-filled" : "thumbs-up"}
          onClick={() => {
            onThumbsUp();
            setSelectedIcon(1);
          }}
        />
      )}
      {(selectedIcon === 0 || selectedIcon === null) && (
        <Button
          iconName={selectedIcon === 0 ? "thumbs-down-filled" : "thumbs-down"}
          variant="icon"
          onClick={() => {
            onThumbsDown();
            setSelectedIcon(0);
          }}
        />
      )}
    </div>
  );
}
