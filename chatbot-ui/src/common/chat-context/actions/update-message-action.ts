import { ChatMessage, ChatMessageSender } from '../../types';
import { ChatAction, ChatActionKind } from '../chat-action';
import { ChatState } from '../chat-state';

export interface UpdateMessageAction {
  kind: ChatActionKind.UPDATE_MESSAGE;
  payload: {
    generationId: string;
    sessionId: string | null;
    error: boolean;
    content: string;
  };
}

export function isUpdateMessageAction(action: ChatAction): action is UpdateMessageAction {
  return action.kind === ChatActionKind.UPDATE_MESSAGE;
}

export function updateMessageAction(state: ChatState, action: UpdateMessageAction): ChatState {
  state = {
    ...state,
    currentSession: {
      ...state.currentSession,
      sessionId: action.payload.sessionId || state.currentSession.sessionId,
      messages: state.currentSession.messages.map((message) => {
        if (message.generationId === action.payload.generationId && message.sender === ChatMessageSender.SYSTEM) {
          const chatMessage: ChatMessage = {
            ...message,
            error: action.payload.error || false,
            content: (message.content ?? '') + action.payload.content,
          };

          return chatMessage;
        }

        return message;
      }),
    },
  };

  return state;
}
