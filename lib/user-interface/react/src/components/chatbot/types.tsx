export enum ChatbotMessageType {
  AI = 'ai',
  Human = 'human',
  Running = 'running',
}

export enum ChatbotActions {
  Run = 'run',
  ListModels = 'listModels',
  GetSession = 'getSession',
  ListSessions = 'listSessions',
  DeleteSession = 'deleteSession',
  DeleteUserSessions = 'deleteUserSessions',
  ListRagSources = 'listRagSources',
  FinalResponse = 'final_response',
  LLMNewToken = 'llm_new_token',
  Error = 'error',
}
