import { useContext } from 'react';
import { Switch } from '@headlessui/react';
import { Utils } from '../../common/utils';
import { ChatContext } from '../../common/chat-context/chat-context';
import { ChatMode } from '../../common/chat-context/chat-state';
import { ChatActionKind } from '../../common/chat-context/chat-action';

export default function ModeSelect() {
  const { state, dispatch } = useContext(ChatContext);

  const setEnabled = (enabled: boolean) => {
    dispatch({
      kind: ChatActionKind.SET_CHAT_MODE,
      payload: {
        mode: enabled ? ChatMode.STREAMING : ChatMode.STANDARD,
      },
    });
  };

  const enabled = state.mode === ChatMode.STREAMING;

  return (
    <Switch.Group as="div" className="flex items-center">
      <Switch
        checked={state.mode === ChatMode.STREAMING}
        onChange={setEnabled}
        className={Utils.classNames(
          enabled ? 'bg-gray-500 dark:bg-gray-500' : 'bg-gray-400 dark:bg-gray-700',
          'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2',
        )}
      >
        <span
          className={Utils.classNames(
            enabled ? 'translate-x-5' : 'translate-x-0',
            'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
          )}
        />
      </Switch>
      <Switch.Label as="span" className="ml-3 text-sm">
        <span className="font-medium text-gray-900 dark:text-white">Streaming</span>
      </Switch.Label>
    </Switch.Group>
  );
}
