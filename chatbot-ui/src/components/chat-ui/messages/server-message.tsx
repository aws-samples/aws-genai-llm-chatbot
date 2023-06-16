import ReactMarkdown from 'react-markdown';
import { ChatMessage } from '../../../common/types';
import Ellipsis from '../../ellipsis';

export default function ServerMessage({ message }: { message: ChatMessage }) {
  return (
    <div className="bg-gray-50 shadow sm:rounded-lg my-2 py-4 px-4 overflow-x-scroll dark:text-white dark:bg-gray-700">
      {!message.content && !message.error ? <Ellipsis /> : <ReactMarkdown>{message.content || ''}</ReactMarkdown>}
    </div>
  );
}
