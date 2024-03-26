import { useState } from "react";
import BaseAppLayout from "../../../components/base-app-layout";
import Chat from "../../../components/chatbot/chat";

import { Link, useParams } from "react-router-dom";
import { Header, HelpPanel } from "@cloudscape-design/components";

export default function Playground() {
  const { sessionId } = useParams();
  const [toolsOpen, setToolsOpen] = useState(false);

  return (
    <BaseAppLayout
      toolsHide={false}
      toolsOpen={toolsOpen}
      onToolsChange={({ detail }) => setToolsOpen(detail.open)}
      tools={
        <HelpPanel header={<Header variant="h3">Using the chat</Header>}>
          <div>
            This chat playground allows user to interact with a chosen LLM and
            optional RAG retriever. If you select a multimodal model, you can
            also upload images to use in the conversation. All conversations are
            saved and can be later accessed via the{" "}
            <Link to="/chatbot/sessions">Session</Link> in the navigation bar.
          </div>
        </HelpPanel>
      }
      toolsWidth={300}
      content={<Chat sessionId={sessionId} />}
    />
  );
}
