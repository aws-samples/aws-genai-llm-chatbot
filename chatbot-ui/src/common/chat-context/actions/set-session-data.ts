import { ChatMessage } from '../../types';
import { ChatAction, ChatActionKind } from '../chat-action';
import { ChatState, GenerationState } from '../chat-state';

export interface SetSessionDataAction {
  kind: ChatActionKind.SET_SESSION_DATA;
  payload: {
    generationState?: GenerationState;
    sessionId?: string | null;
    messages?: ChatMessage[];
  };
}

export function isSetSessionDataAction(action: ChatAction): action is SetSessionDataAction {
  return action.kind === ChatActionKind.SET_SESSION_DATA;
}

export function setSessionDataAction(state: ChatState, action: SetSessionDataAction): ChatState {
  const generationState = typeof action.payload.generationState !== 'undefined' ? action.payload.generationState : state.currentSession.generationState;
  const sessionId = typeof action.payload.sessionId !== 'undefined' ? action.payload.sessionId : state.currentSession.sessionId;
  const messages = typeof action.payload.messages !== 'undefined' ? action.payload.messages : state.currentSession.messages;

  state = {
    ...state,
    currentSession: {
      ...state.currentSession,
      generationState,
      sessionId,
      messages,
    },
  };

  return state;
}
