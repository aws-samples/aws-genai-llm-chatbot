import { useParams } from 'react-router-dom';

import { useEffect } from 'react';

import Chat from '../components/chatbot/Chat';
import Sessions from '../components/chatbot/Sessions';

export function Chatbot({ setTools }) {
  const { sessionId } = useParams();
  useEffect(() => {
    setTools(<Sessions sessionId={sessionId} />);
  }, [setTools]);

  return <Chat setTools={setTools} sessionId={sessionId} />;
}
export default Chatbot;
