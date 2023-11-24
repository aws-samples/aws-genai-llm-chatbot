import BaseAppLayout from "../../../components/base-app-layout";
import MultiChat from "../../../components/chatbot/multi-chat";

export default function MultiChatPlayground() {
  return <BaseAppLayout toolsHide={true} content={<MultiChat />} />;
}
