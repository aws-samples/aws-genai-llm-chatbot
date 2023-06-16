import { getCurrentUser, isSemanticSearchEnabled, semanticSearch, getRequestParams, getSessionManager, createModelAdapter } from './helpers';
import { LambdaGlobal, LambdaEvent } from './types';

export declare const awslambda: LambdaGlobal;

async function messageHandler(event: LambdaEvent, responseStream: object) {
  console.log(`Event: ${JSON.stringify(event)}`);

  const stream = awslambda.HttpResponseStream.from(responseStream, {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const { prompt, modelId, mode, sessionId } = getRequestParams(event);
  const user = await getCurrentUser(event.headers.idtoken);

  const userId = user.sub || '';

  const title = prompt;
  const sessionManager = await getSessionManager({ sessionId, userId, title });
  const adapter = createModelAdapter({ modelId, mode, sessionManager, stream });

  let context: string[] = [];
  if (isSemanticSearchEnabled()) {
    const semanticSearchResults = await semanticSearch({ prompt });
    console.log(`Semantic search results: ${JSON.stringify(semanticSearchResults)}`);
    context = semanticSearchResults.map((result) => result.content);
  }

  const history = await sessionManager.getHistory();
  console.log(`History: ${JSON.stringify(history)}`);

  const generatedText = await adapter.complete({ prompt, context, history });
  console.log(`Generated text: ${generatedText}`);
}

export const handler = awslambda.streamifyResponse(messageHandler);
