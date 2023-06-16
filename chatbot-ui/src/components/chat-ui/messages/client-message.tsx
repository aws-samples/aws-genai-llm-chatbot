import { ChatMessage } from '../../../common/types';
import MessageNewlineText from '../../newline-text';

export default function ClientMessage({ message }: { message: ChatMessage }) {
  return (
    <div className="flex">
      <div className="mt-3 mb-2 px-4 overflow-wrap break-word break-all dark:text-white">
        <MessageNewlineText text={message.content ?? ''} />
      </div>
    </div>
  );
}
