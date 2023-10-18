import { useState } from "react";
import BaseAppLayout from "../../../components/base-app-layout";
import Sessions from "../../../components/chatbot/sessions";
import { useParams } from "react-router-dom";
import MultiChat from "../../../components/chatbot/multi-chat";

export default function MultiChatPlayground() {
  const { sessionId } = useParams();
  const [toolsOpen, setToolsOpen] = useState(false);

  return (
    <BaseAppLayout
      toolsHide={true}
      // toolsOpen={toolsOpen}
      // onToolsChange={({ detail }) => setToolsOpen(detail.open)}
      // tools={<Sessions toolsOpen={toolsOpen} />}
      // toolsWidth={500}
      content={<MultiChat />}
    />
  );
}
