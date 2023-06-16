import { ChatMessageSender } from '../../types';
import { ChatAction, ChatActionKind } from '../chat-action';
import { ChatState } from '../chat-state';

export interface AddMessageAction {
  kind: ChatActionKind.ADD_MESSAGE;
  payload: {
    generationId: string;
    prompt: string;
  };
}

export function isAddMessageAction(action: ChatAction): action is AddMessageAction {
  return action.kind === ChatActionKind.ADD_MESSAGE;
}

export function addMessageAction(state: ChatState, action: AddMessageAction): ChatState {
  state = {
    ...state,
    currentSession: {
      ...state.currentSession,
      messages: [
        ...state.currentSession.messages,
        {
          sender: ChatMessageSender.USER,
          generationId: action.payload.generationId,
          content: action.payload.prompt,
          error: false,
        },
        {
          sender: ChatMessageSender.SYSTEM,
          generationId: action.payload.generationId,
          error: false,
        },
      ],
    },
  };

  return state;
}
