import Chat from "../../../components/chatbot/chat";
import { useParams } from "react-router-dom";
import {useEffect} from "react";

export default function Embedded() {
  const { sessionId } = useParams();

  useEffect(() => {
    document.documentElement.style.backgroundColor = "transparent";
    document.body.style.backgroundColor = "transparent";
  }, []);

  return (
    <div
      style={{
        borderRadius: 10,
        flexGrow: 1,
        margin: 20,
      }}
    >
      <Chat sessionId={sessionId} />
    </div>
  );
}
