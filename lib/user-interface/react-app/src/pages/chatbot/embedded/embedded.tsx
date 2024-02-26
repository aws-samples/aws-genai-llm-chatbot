import Chat from "../../../components/chatbot/chat";
import { useParams } from "react-router-dom";
import {useState} from "react";
import chatIcon from "../../../assets/images/chat-icon.webp"

export default function Embedded() {
  const { sessionId } = useParams();
  const [open, setOpen] = useState(false)
  return (
    <div
      id="ChatWindow"
      style={{
        borderRadius: 10,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        alignItems: 'flex-end',
        left: 0,
        position: 'fixed',
        right: 0,
        top: 0,
        margin: 20
      }}
    >
      { open && <div><Chat sessionId={sessionId} /></div> }
      <button
        id="ChatButton"
        onClick={() => {
          setOpen(!open)
        }}
        style={{
          borderRadius: 10,
          background: 'white',
          margin: 10,
          border: '1px solid light-blue',
        }}
      >
        <img src={chatIcon} width={40} />
      </button>
    </div>
  );
}
