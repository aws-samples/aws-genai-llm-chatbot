import { SetModelsAction } from './actions/set-models-action';
import { UpdateMessageAction } from './actions/update-message-action';
import { AddMessageAction } from './actions/add-message-action';
import { SetGenerationStateAction } from './actions/set-generation-state-action';
import { SetModelIdAction } from './actions/set-model-id-action';
import { AddSessionsAction } from './actions/add-sessions-action';
import { SetSessionDataAction } from './actions/set-session-data';
import { SetChatModeAction } from './actions/set-chat-mode';

export enum ChatActionKind {
  SET_MODELS = 'SET_MODELS',
  SET_MODEL_ID = 'SET_MODEL_ID',
  SET_CHAT_MODE = 'SET_CHAT_MODE',
  ADD_SESSIONS = 'ADD_SESSIONS',
  SET_GENERATION_STATE = 'SET_GENERATION_STATE',
  ADD_MESSAGE = 'ADD_MESSAGE',
  UPDATE_MESSAGE = 'UPDATE_MESSAGE',
  SET_SESSION_DATA = 'SET_SESSION_DATA',
}

export type ChatAction =
  | SetGenerationStateAction
  | AddMessageAction
  | UpdateMessageAction
  | SetModelsAction
  | SetModelIdAction
  | AddSessionsAction
  | SetSessionDataAction
  | SetChatModeAction;
