import { useParams } from "react-router-dom";
import Chat from "../../components/chatbot/chat";
import styles from "../../styles/chat.module.scss";

export default function ApplicationChat() {
  const { applicationId, sessionId } = useParams();

  return (
    <div
      className={styles.appChatContainer}
      data-locator="chatbot-ai-container"
    >
      <Chat sessionId={sessionId} applicationId={applicationId} />
    </div>
  );
}
