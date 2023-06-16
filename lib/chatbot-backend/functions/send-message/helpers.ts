import * as crypto from 'crypto';

import { ModelAdapterBase } from './adapters/base';
import { CognitoAuth } from './common/cognito-auth';
import { getModelAdapter } from './common/model-adapter';
import { SemanticSearchClient } from './common/semantic-search-client';
import { SessionManager } from './common/session-manager';
import { CreateModelAdatper, CreateSessionManager, LambdaEvent, SemanticSearchParams } from './types';

const LARGE_LANGUAGE_MODELS = JSON.parse(process.env.LARGE_LANGUAGE_MODELS || '{}');
const SEMANTIC_SEARCH_API = process.env.SEMANTIC_SEARCH_API || '';
const SESSION_TABLE_NAME = process.env.SESSION_TABLE_NAME || '';

const COGNITO_AUTH = new CognitoAuth();

export const getCurrentUser = async (idToken?: string) => {
  const userPayload = await COGNITO_AUTH.verify(idToken);

  if (userPayload && userPayload.sub) {
    return userPayload;
  }

  const error = 'Unauthorized request';
  console.log(error);
  throw new Error(error);
};

export const isSemanticSearchEnabled = () => {
  return SEMANTIC_SEARCH_API !== '';
};

export const semanticSearch = async ({ prompt }: SemanticSearchParams) => {
  if (!isSemanticSearchEnabled()) {
    console.log(`Semantic search disabled`);
    return [];
  }

  console.log(`Semantic search enabled`);
  const semanticSearchClient = new SemanticSearchClient(SEMANTIC_SEARCH_API);
  console.log(`Semantic search client: ${JSON.stringify(semanticSearchClient)}`);

  const semanticSearchResults = await semanticSearchClient.search(prompt);
  console.log(`Semantic search results: ${JSON.stringify(semanticSearchResults)}`);
  return semanticSearchResults;
};

export const getRequestParams = (event: LambdaEvent) => {
  const request: {
    prompt: string;
    modelId: string;
    sessionId?: string;
    mode: string;
  } = JSON.parse(event.body);

  const prompt = request.prompt;
  const modelId = request.modelId;
  const mode = request.mode;

  if (!isValidModelId(modelId)) {
    const error = `Invalid model ID: ${modelId}`;
    console.log(error);
    throw new Error(error);
  }

  if (!prompt || prompt.trim().length === 0) {
    const error = `Invalid prompt. Cannot be empty.`;
    console.log(error);
    throw new Error(error);
  }

  let sessionId = null;

  if (!request.sessionId) {
    sessionId = crypto.randomUUID();
    console.log(`New session: ${sessionId}\n${prompt}`);
  } else {
    sessionId = request.sessionId;
    console.log(`Existing session: ${sessionId}\n${prompt}`);
  }

  console.log(`PARAM Prompt: ${prompt}`);
  console.log(`PARAM Model ID: ${modelId}`);
  console.log(`PARAM Mode: ${mode}`);
  console.log(`PARAM Session ID: ${sessionId}`);

  return { prompt, modelId, mode, sessionId };
};

export const isValidModelId = (modelId: string) => {
  if (LARGE_LANGUAGE_MODELS[modelId]) {
    return true;
  }

  return false;
};

export const getSessionManager = async ({ sessionId, userId, title }: CreateSessionManager) => {
  const sessionManager = new SessionManager({
    sessionTableName: SESSION_TABLE_NAME,
    sessionId,
    userId,
    title,
  });
  console.log(`Session manager: ${JSON.stringify(sessionManager)}`);
  await sessionManager.init();
  console.log(`Session manager initialized with session: ${sessionManager.session}`);

  return sessionManager;
};

export const createModelAdapter = ({ modelId, mode, sessionManager, stream }: CreateModelAdatper) => {
  const sessionId = sessionManager.sessionId;

  const adapter: ModelAdapterBase = getModelAdapter(modelId, {
    mode,
  });

  adapter.onStream(async ({ timestamp, sender, message }) => stream.write(JSON.stringify({ timestamp, sender, message, sessionId })));
  adapter.onComplete(async ({ prompt, history, generatedText }) => {
    try {
      await sessionManager.setHistory(history, prompt, generatedText);
    } finally {
      console.log(`Closing stream`);
      stream.end();
    }
  });
  adapter.onError(async (error) => {
    console.log(`Error: ${error}`);
    stream.write(JSON.stringify({ error: error, sessionId }));
  });
  adapter.shouldStopGeneration(async () => await sessionManager.getShouldStop());
  adapter.onStoppedGeneration(async () => await sessionManager.setShouldStop(false));

  console.log(`Adapter: ${JSON.stringify(adapter)}`);
  return adapter;
};
