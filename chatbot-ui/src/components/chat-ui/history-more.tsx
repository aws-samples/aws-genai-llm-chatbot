import { useContext, useState } from 'react';
import { AppContext } from '../../common/app-context';
import { ChatContext } from '../../common/chat-context/chat-context';
import { ClientFactory } from '../../common/clients/client-factory';
import { ChatActionKind } from '../../common/chat-context/chat-action';
import { Utils } from '../../common/utils';

export default function HistoryMore() {
  const appConfig = useContext(AppContext);
  const { state, dispatch } = useContext(ChatContext);
  const [loading, setLoading] = useState(false);

  const onLoadMoreClick = async () => {
    setLoading(true);

    const client = ClientFactory.getClient(appConfig);
    let last = '';
    if (state.sessions.items.length > 0) {
      last = state.sessions.items[state.sessions.items.length - 1].startTime;
    }

    const result = await client?.listSessions(last);

    if (result) {
      dispatch({
        kind: ChatActionKind.ADD_SESSIONS,
        payload: {
          sessions: result.sessions,
          hasMore: result.hasMore,
        },
      });
    }

    setLoading(false);
  };

  const isLoading = loading || (state.sessions.hasMore && state.sessions.items.length === 0);

  return (
    <div className="flex items-center justify-center pt-2">
      <button
        type="button"
        className={Utils.classNames(
          'rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50',
          'dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:hover:bg-gray-600',
        )}
        onClick={onLoadMoreClick}
        disabled={isLoading}
      >
        {isLoading ? 'Loading...' : '  Load More'}
      </button>
    </div>
  );
}
