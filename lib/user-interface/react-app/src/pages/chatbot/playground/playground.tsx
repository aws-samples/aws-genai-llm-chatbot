import { useState } from "react";
import BaseAppLayout from "../../../components/base-app-layout";
import Chat from "../../../components/chatbot/chat";
import Sessions from "../../../components/chatbot/sessions";
import { useParams } from "react-router-dom";

export default function Playground() {
  const { sessionId } = useParams();
  const [toolsOpen, setToolsOpen] = useState(false);

  return (
    <BaseAppLayout
      toolsHide={false}
      toolsOpen={toolsOpen}
      onToolsChange={({ detail }) => setToolsOpen(detail.open)}
      tools={<Sessions toolsOpen={toolsOpen} />}
      toolsWidth={500}
      content={<Chat sessionId={sessionId} />}
    />
  );
}
