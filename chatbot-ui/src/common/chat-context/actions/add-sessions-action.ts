import { ChatAction, ChatActionKind } from '../chat-action';
import { ChatState, ChatStateSession } from '../chat-state';

export interface AddSessionsAction {
  kind: ChatActionKind.ADD_SESSIONS;
  payload: {
    sessions: ChatStateSession[];
    hasMore?: boolean;
    override?: boolean;
  };
}

export function isAddSessionsAction(action: ChatAction): action is AddSessionsAction {
  return action.kind === ChatActionKind.ADD_SESSIONS;
}

export function addSessionsAction(state: ChatState, action: AddSessionsAction): ChatState {
  let sessions = action.payload.override ? action.payload.sessions : [...state.sessions.items, ...action.payload.sessions];

  const uniqueSessions = sessions.reduce((obj: { [key: string]: ChatStateSession }, item) => {
    obj[item.sessionId] = item;
    return obj;
  }, {});

  sessions = Object.values(uniqueSessions);
  sessions.sort((a, b) => {
    return -a.startTime.localeCompare(b.startTime);
  });

  const hasMore = action.payload.hasMore ?? state.sessions.hasMore;

  state = {
    ...state,
    sessions: {
      ...state.sessions,
      items: sessions,
      hasMore,
    },
  };

  return state;
}
