import { Bars3Icon } from '@heroicons/react/20/solid';
import { useContext, useEffect, useMemo, useReducer, useState } from 'react';
import { ChatContext, chatReducer, initialState } from '../../common/chat-context/chat-context';
import { AppContext } from '../../common/app-context';
import Welcome from './welcome';
import MessageList from './message-list';
import PromptInput from './prompt-input';
import LinksPanel from './links-panel';
import ModelSelect from './model-select';
import HistoryFlyout from './history-flyout';
import { ClientFactory } from '../../common/clients/client-factory';
import { Utils } from '../../common/utils';
import ModeSelect from './mode-select';

function ChatUI() {
  const appConfig = useContext(AppContext);
  const [state, dispatch] = useReducer(chatReducer, initialState);
  const [showFlyout, setShowFlyout] = useState(false);
  const store = useMemo(() => ({ state, dispatch }), [state]);

  useEffect(() => {
    if (!appConfig) return;
  }, [appConfig, dispatch]);

  useEffect(() => {
    const onBeforeUnload = async (_: BeforeUnloadEvent) => {
      const client = ClientFactory.getClient(appConfig);
      await client?.stopGeneration(state.currentSession.sessionId);
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [appConfig, dispatch, state.currentSession.sessionId]);

  const onToggleFlyout = () => {
    setShowFlyout(!showFlyout);
  };

  return (
    <ChatContext.Provider value={store}>
      <div className="fixed top-4 right-4 z-10">
        <button
          type="button"
          className={Utils.classNames(
            'rounded-md bg-white px-3.5 py-2.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50',
            'dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:hover:bg-gray-600',
          )}
          onClick={onToggleFlyout}
        >
          <Bars3Icon className="-mr-0.5 h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <HistoryFlyout show={showFlyout} setShow={setShowFlyout} />
      <div className="h-full w-full relative bg-gray-200 dark:bg-gray-800">
        {state.currentSession.messages.length === 0 ? <Welcome /> : <MessageList />}
        <div className="fixed bottom-0 left-0 right-0  bg-gray-200 dark:bg-gray-800">
          <div className="flex flex-col justify-center items-center my-4 bg-gray-200 dark:bg-gray-800">
            <PromptInput />
            <div className="mt-4 grid grid-cols-2 gap-4 items-center w-10/12 lg:w-2/3 max-w-4xl sm:grid-cols-3">
              <ModelSelect />
              <ModeSelect />
              <LinksPanel />
            </div>
          </div>
        </div>
      </div>
    </ChatContext.Provider>
  );
}

export default ChatUI;
