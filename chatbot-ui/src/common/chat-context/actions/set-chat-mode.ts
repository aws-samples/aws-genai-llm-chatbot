import { ChatAction, ChatActionKind } from '../chat-action';
import { ChatMode, ChatState } from '../chat-state';

export interface SetChatModeAction {
  kind: ChatActionKind.SET_CHAT_MODE;
  payload: {
    mode: ChatMode;
  };
}

export function isSetChatModeAction(action: ChatAction): action is SetChatModeAction {
  return action.kind === ChatActionKind.SET_CHAT_MODE;
}

export function setChatMode(state: ChatState, action: SetChatModeAction): ChatState {
  state = {
    ...state,
    mode: action.payload.mode,
  };

  return state;
}
