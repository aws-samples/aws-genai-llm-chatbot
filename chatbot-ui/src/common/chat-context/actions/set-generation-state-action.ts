import { ChatAction, ChatActionKind } from '../chat-action';
import { ChatState, GenerationState } from '../chat-state';

export interface SetGenerationStateAction {
  kind: ChatActionKind.SET_GENERATION_STATE;
  payload: {
    generationState: GenerationState;
  };
}

export function isSetGenerationStateAction(action: ChatAction): action is SetGenerationStateAction {
  return action.kind === ChatActionKind.SET_GENERATION_STATE;
}

export function setGenerationStateAction(state: ChatState, action: SetGenerationStateAction): ChatState {
  return {
    ...state,
    currentSession: {
      ...state.currentSession,
      generationState: action.payload.generationState,
    },
  };
}
