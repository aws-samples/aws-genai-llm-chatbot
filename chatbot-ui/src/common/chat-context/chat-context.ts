import { createContext } from 'react';
import { ChatMode, ChatState, GenerationState } from './chat-state';
import { ChatAction } from './chat-action';
import { isSetGenerationStateAction, setGenerationStateAction } from './actions/set-generation-state-action';
import { isUpdateMessageAction, updateMessageAction } from './actions/update-message-action';
import { isSetModelsAction, setModelsAction } from './actions/set-models-action';
import { addMessageAction, isAddMessageAction } from './actions/add-message-action';
import { isSetModelIdAction, setModelIdAction } from './actions/set-model-id-action';
import { addSessionsAction, isAddSessionsAction } from './actions/add-sessions-action';
import { isSetSessionDataAction, setSessionDataAction } from './actions/set-session-data';
import { isSetChatModeAction, setChatMode } from './actions/set-chat-mode';

export const initialState: ChatState = {
  models: [],
  modelId: null,
  mode: ChatMode.STREAMING,
  sessions: {
    items: [],
    hasMore: true,
  },
  currentSession: {
    sessionId: null,
    generationState: GenerationState.IDLE,
    messages: [],
  },
};

export const ChatContext = createContext<{
  state: ChatState;
  dispatch: React.Dispatch<ChatAction>;
}>({
  state: initialState,
  dispatch: () => {},
});

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  if (isSetGenerationStateAction(action)) {
    return setGenerationStateAction(state, action);
  } else if (isAddMessageAction(action)) {
    return addMessageAction(state, action);
  } else if (isUpdateMessageAction(action)) {
    return updateMessageAction(state, action);
  } else if (isSetModelsAction(action)) {
    return setModelsAction(state, action);
  } else if (isSetModelIdAction(action)) {
    return setModelIdAction(state, action);
  } else if (isAddSessionsAction(action)) {
    return addSessionsAction(state, action);
  } else if (isSetSessionDataAction(action)) {
    return setSessionDataAction(state, action);
  } else if (isSetChatModeAction(action)) {
    return setChatMode(state, action);
  }

  return state;
}
