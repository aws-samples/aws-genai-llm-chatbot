import { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Utils } from '../../common/utils';
import { ChatContext } from '../../common/chat-context/chat-context';
import { GenerationState } from '../../common/chat-context/chat-state';
import { ChatActionKind } from '../../common/chat-context/chat-action';
import { AppContext } from '../../common/app-context';
import { ClientFactory } from '../../common/clients/client-factory';

let userHasScrolled = false;

function PromptInput() {
  const appConfig = useContext(AppContext);
  const { state, dispatch } = useContext(ChatContext);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const [prompt, setPrompt] = useState('');
  const [focused, setFocused] = useState(false);

  const reconcileHeight = (element: HTMLTextAreaElement | null) => {
    if (!element) return;

    element.style.height = 'inherit';
    let height = element.scrollHeight;
    height = Math.min(height, 200);
    element.style.height = `${height}px`;
  };

  useLayoutEffect(() => {
    if (!userHasScrolled && state.currentSession.messages.length > 0) {
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: 'auto',
      });
    }
  }, [state.currentSession.messages]);

  useEffect(() => {
    const onWindowScroll = () => {
      const isScrollToTheEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight;

      if (!isScrollToTheEnd) {
        userHasScrolled = true;
      } else {
        userHasScrolled = false;
      }
    };

    window.addEventListener('scroll', onWindowScroll);

    return () => {
      window.removeEventListener('scroll', onWindowScroll);
    };
  }, []);

  useEffect(() => {
    reconcileHeight(textAreaRef.current);
  }, [prompt]);

  const onInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(event.target.value);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && event.getModifierState('Shift') === false) {
      event.preventDefault();
      submit();
    }
  };

  const submit = async () => {
    if (state.currentSession.generationState !== GenerationState.IDLE) return;
    if (!state.modelId) return;

    const client = ClientFactory.getClient(appConfig);
    const currentPrompt = prompt.trim();
    if (currentPrompt.length === 0) return;

    const generationId = Utils.generateUUID();

    setPrompt('');
    textAreaRef.current?.focus();
    userHasScrolled = false;

    dispatch({
      kind: ChatActionKind.ADD_MESSAGE,
      payload: {
        generationId,
        prompt: currentPrompt,
      },
    });

    dispatch({
      kind: ChatActionKind.SET_GENERATION_STATE,
      payload: {
        generationState: GenerationState.GENERATING,
      },
    });

    try {
      await client?.makeRequest({
        modelId: state.modelId,
        sessionId: state.currentSession.sessionId,
        mode: state.mode,
        prompt: currentPrompt,
        onData: (sessionId: string, content: string) => {
          dispatch({
            kind: ChatActionKind.UPDATE_MESSAGE,
            payload: {
              generationId,
              sessionId,
              error: false,
              content,
            },
          });
        },
        onError: (sessionId: string, error: string) => {
          dispatch({
            kind: ChatActionKind.UPDATE_MESSAGE,
            payload: {
              generationId,
              sessionId,
              error: true,
              content: JSON.stringify(error),
            },
          });
        },
      });
    } catch (e) {
      console.error(e);

      dispatch({
        kind: ChatActionKind.UPDATE_MESSAGE,
        payload: {
          generationId,
          sessionId: state.currentSession.sessionId,
          error: true,
          content: 'Error generating response',
        },
      });
    }

    dispatch({
      kind: ChatActionKind.SET_GENERATION_STATE,
      payload: { generationState: GenerationState.IDLE },
    });

    const listSessionsResult = await client?.listSessions('');
    if (listSessionsResult) {
      dispatch({
        kind: ChatActionKind.ADD_SESSIONS,
        payload: {
          sessions: listSessionsResult.sessions,
        },
      });
    }
  };

  const stopGeneration = async () => {
    const client = ClientFactory.getClient(appConfig);
    await client?.stopGeneration(state.currentSession.sessionId);
  };

  const hasPrompt = prompt.trim().length > 0;
  const isIdle = state.currentSession.generationState === GenerationState.IDLE;
  const isGenerating = state.currentSession.generationState === GenerationState.GENERATING;
  const hasModels = state.models.length > 0;
  const canSubmit = hasPrompt && hasModels && isIdle;

  return (
    <div
      className={Utils.classNames(
        'grid grid-cols-[1fr_auto] w-10/12 lg:w-2/3 max-w-4xl rounded-lg transition border bg-gray-100 justify-stretch align-middle ',
        'dark:text-white dark:bg-gray-700',
        focused ? 'border-gray-400 dark:border-gray-300' : 'border-gray-300 dark:border-gray-400',
      )}
    >
      <textarea
        className="my-4 ml-4 p-1 border-none bg-transparent resize-none focus:outline-none "
        placeholder="Enter a query..."
        ref={textAreaRef}
        maxLength={1000}
        rows={1}
        onInput={onInput}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        value={prompt}
      ></textarea>
      <div className="flex flex-col justify-center align-middle">
        {isGenerating && state.currentSession.sessionId ? (
          <div className="w-full h-full flex justify-center items-center px-2">
            <button
              className={Utils.classNames(
                'px-2 py-2 rounded text-gray-600 hover:text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:text-white dark:hover:text-white dark:ring-gray-600 dark:hover:bg-gray-800',
              )}
              onClick={stopGeneration}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
            >
              Stop generation
            </button>
          </div>
        ) : (
          <button
            className={Utils.classNames(
              'border-transparent w-full h-full px-4 py-4 hover:enabled:text-gray-900 dark:hover:enabled:text-gray-100 active:enabled:text-blue-900 outline-gray-400',
              canSubmit ? 'text-gray-600 dark:text-gray-300' : 'text-gray-400 dark:text-gray-600',
            )}
            disabled={!canSubmit}
            onClick={submit}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 -rotate-45">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        )}
      </div>
      <div></div>
    </div>
  );
}

export default PromptInput;
