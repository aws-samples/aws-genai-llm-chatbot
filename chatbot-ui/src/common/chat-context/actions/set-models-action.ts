import { ChatAction, ChatActionKind } from '../chat-action';
import { ChatState } from '../chat-state';

export interface SetModelsAction {
  kind: ChatActionKind.SET_MODELS;
  payload: {
    models: string[];
  };
}

export function isSetModelsAction(action: ChatAction): action is SetModelsAction {
  return action.kind === ChatActionKind.SET_MODELS;
}

export function setModelsAction(state: ChatState, action: SetModelsAction): ChatState {
  const { models } = action.payload;
  let modelId: string | null = state.modelId;
  if (models.length > 0 && modelId === null) {
    modelId = models[0];
  }

  state = {
    ...state,
    models,
    modelId,
  };

  return state;
}
