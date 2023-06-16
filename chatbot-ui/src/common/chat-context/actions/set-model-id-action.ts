import { ChatAction, ChatActionKind } from '../chat-action';
import { ChatState } from '../chat-state';

export interface SetModelIdAction {
  kind: ChatActionKind.SET_MODEL_ID;
  payload: {
    modelId: string;
  };
}

export function isSetModelIdAction(action: ChatAction): action is SetModelIdAction {
  return action.kind === ChatActionKind.SET_MODEL_ID;
}

export function setModelIdAction(state: ChatState, action: SetModelIdAction): ChatState {
  const { modelId } = action.payload;

  state = {
    ...state,
    modelId,
  };

  return state;
}
