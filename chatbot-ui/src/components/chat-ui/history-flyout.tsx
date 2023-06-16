import { Fragment, useContext, useEffect, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { ChatContext } from '../../common/chat-context/chat-context';
import { AppContext } from '../../common/app-context';
import { ClientFactory } from '../../common/clients/client-factory';
import { ChatActionKind } from '../../common/chat-context/chat-action';
import HistoryMore from './history-more';
import { GenerationState } from '../../common/chat-context/chat-state';
import { Utils } from '../../common/utils';

export default function HistoryFlyout(props: { show: boolean; setShow: (show: boolean) => void }) {
  const appConfig = useContext(AppContext);
  const { state, dispatch } = useContext(ChatContext);
  const [actionsDisabled, setActionsDisabled] = useState(false);

  const onNewChatClick = async () => {
    setActionsDisabled(true);

    if (state.currentSession.generationState === GenerationState.GENERATING) {
      const client = ClientFactory.getClient(appConfig);
      await client?.stopGeneration(state.currentSession.sessionId);
    }

    dispatch({
      kind: ChatActionKind.SET_SESSION_DATA,
      payload: {
        generationState: GenerationState.IDLE,
        sessionId: null,
        messages: [],
      },
    });

    props.setShow(false);
    setActionsDisabled(false);
  };

  const onClearSessionsClick = async () => {
    if (window.confirm('Are you sure you want to clear all chat history?')) {
      setActionsDisabled(true);

      const client = ClientFactory.getClient(appConfig);
      if (state.currentSession.generationState === GenerationState.GENERATING) {
        await client?.stopGeneration(state.currentSession.sessionId);
      }

      await client?.clearSessions();

      dispatch({
        kind: ChatActionKind.ADD_SESSIONS,
        payload: {
          sessions: [],
          hasMore: false,
          override: true,
        },
      });

      dispatch({
        kind: ChatActionKind.SET_SESSION_DATA,
        payload: {
          generationState: GenerationState.IDLE,
          sessionId: null,
          messages: [],
        },
      });

      props.setShow(false);
      setActionsDisabled(false);
    }
  };

  return (
    <Transition.Root show={props.show} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={props.setShow}>
        <div className="fixed inset-0" />

        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10 sm:pl-16">
              <Transition.Child
                as={Fragment}
                enter="transform transition ease-in-out duration-500 sm:duration-700"
                enterFrom="translate-x-full"
                enterTo="translate-x-0"
                leave="transform transition ease-in-out duration-500 sm:duration-700"
                leaveFrom="translate-x-0"
                leaveTo="translate-x-full"
              >
                <Dialog.Panel className="pointer-events-auto w-screen max-w-md">
                  <div className="h-full overflow-y-scroll bg-white dark:bg-gray-900 py-6 shadow-xl grid grid-rows-[auto_1fr] gap-4">
                    <div className="px-4 sm:px-6">
                      <div className="flex items-start justify-between">
                        <Dialog.Title className="text-base font-semibold leading-6 text-gray-900 dark:text-white">History</Dialog.Title>
                        <div className="ml-3 flex h-7 items-center gap-3">
                          <button
                            type="button"
                            className={Utils.classNames(
                              'rounded bg-white px-2 py-1 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 enabled:hover:bg-gray-50',
                              'dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:enabled:hover:bg-gray-600',
                            )}
                            onClick={onNewChatClick}
                            disabled={actionsDisabled}
                          >
                            New chat
                          </button>
                          <button
                            type="button"
                            className="rounded-md text-gray-400 enabled:hover:text-gray-500 dark:text-white dark:enabled:text-gray-100 focus:outline-none focus:ring-0 focus:ring-none focus:ring-offset-2"
                            onClick={onClearSessionsClick}
                            disabled={actionsDisabled}
                          >
                            <TrashIcon className="h-6 w-6" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="rounded-md text-gray-400 hover:text-gray-500 dark:text-white dark:hover:text-gray-400 focus:outline-none focus:ring-0 focus:ring-none focus:ring-offset-2"
                            onClick={() => props.setShow(false)}
                          >
                            <span className="sr-only">Close panel</span>
                            <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="relative overflow-y-scroll">
                      <SessionHistory actionsDisabled={actionsDisabled} setActionsDisabled={setActionsDisabled} setShow={props.setShow} />
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}

function SessionHistory(props: { actionsDisabled: boolean; setActionsDisabled: (selectingSession: boolean) => void; setShow: (show: boolean) => void }) {
  const appConfig = useContext(AppContext);
  const { state, dispatch } = useContext(ChatContext);

  useEffect(() => {
    if (state.sessions.items.length > 0) return;

    (async () => {
      const client = ClientFactory.getClient(appConfig);
      const result = await client?.listSessions('');

      if (result) {
        dispatch({
          kind: ChatActionKind.ADD_SESSIONS,
          payload: {
            sessions: result.sessions,
            hasMore: result.hasMore,
          },
        });
      }
    })();
  }, [appConfig, dispatch, state.sessions.items.length]);

  const onSelectSession = async (sessionId: string) => {
    if (props.actionsDisabled) return;
    if (state.currentSession.sessionId === sessionId) return;
    props.setActionsDisabled(true);

    const client = ClientFactory.getClient(appConfig);
    if (state.currentSession.generationState === GenerationState.GENERATING) {
      await client?.stopGeneration(state.currentSession.sessionId);
    }

    const result = await client?.getSession(sessionId);
    if (result) {
      dispatch({
        kind: ChatActionKind.SET_SESSION_DATA,
        payload: {
          generationState: GenerationState.IDLE,
          sessionId: result.sessionId,
          messages: result.history.map((message) => ({
            generationId: Utils.generateUUID(),
            sender: message.sender,
            content: message.content,
            error: false,
          })),
        },
      });
    }

    props.setShow(false);
    props.setActionsDisabled(false);
  };

  return (
    <>
      <ul className="divide-y divide-gray-100">
        {state.sessions.items.map((session) => (
          <li
            key={session.sessionId}
            className={Utils.classNames('relative flex justify-between gap-x-6 py-4 px-6', props.actionsDisabled ? '' : 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800')}
            onClick={() => onSelectSession(session.sessionId)}
          >
            <div className={Utils.classNames('text-sm font-semibold leading-6 truncate ', props.actionsDisabled ? 'text-gray-400' : 'text-gray-900 dark:text-white')}>
              {session.title}
            </div>
          </li>
        ))}
      </ul>
      {!state.sessions.hasMore && state.sessions.items.length === 0 && (
        <div className="flex h-full items-center justify-center dark:text-white">
          <div>No chat history yet</div>
        </div>
      )}
      {state.sessions.hasMore && <HistoryMore />}
    </>
  );
}
