import { Fragment, useContext } from 'react';
import { ChatContext } from '../../common/chat-context/chat-context';
import ClientMessage from './messages/client-message';
import ServerMessage from './messages/server-message';
import { ChatMessageSender } from '../../common/types';

function MessageList() {
  const { state } = useContext(ChatContext);

  return (
    <div className="pb-36 pt-4 flex flex-col items-center bg-gray-200 dark:bg-gray-800">
      <div className="w-10/12 lg:w-2/3 max-w-4xl">
        {state.currentSession.messages.map((message) => (
          <Fragment key={`${message.generationId}\\${message.sender}`}>
            {message.sender === ChatMessageSender.USER && <ClientMessage message={message} />}
            {message.sender === ChatMessageSender.SYSTEM && <ServerMessage message={message} />}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

export default MessageList;
