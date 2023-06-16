import { injectLambdaContext } from '@aws-lambda-powertools/logger';
import { logMetrics } from '@aws-lambda-powertools/metrics';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer';
import middy from '@middy/core';

import { clearSessions } from './actions/clear-sessions';
import { getSession } from './actions/get-session';
import { listModels } from './actions/list-models';
import { listSessions } from './actions/list-sessions';
import { stopGeneration } from './actions/stop-generation';
import { CognitoAuth } from './common/cognito-auth';
import { logger, tracer, metrics } from './common/powertools';
import { LambdaEvent } from './types';

const SESSION_TABLE_NAME = process.env.SESSION_TABLE_NAME || '';
const SESSION_TABLE_START_TIME_INDEX_NAME = process.env.SESSION_TABLE_START_TIME_INDEX_NAME || '';

const auth = new CognitoAuth();

`
{
  "action": "stop-generation",
  "sessionId": ""
}

{
  "action": "list-models"
}

{
  "action": "list-sessions",
  "limit": 50,
  "last": ""
}

{
  "action": "get-session",
  "sessionId": ""
}

{
  "action": "clear-sessions"
}
`;

async function actionHandler(event: LambdaEvent) {
  logger.debug(`Event: ${JSON.stringify(event)}`);
  const userPayload = await auth.verify(event.headers.idtoken);
  logger.debug(`User payload: ${JSON.stringify(userPayload)}`);

  if (!userPayload) {
    const error = 'Unauthorized';

    logger.error(error);
    throw new Error(error);
  }

  const userId = userPayload.sub || '';
  const request = JSON.parse(event.body);
  const action = request['action'];

  logger.debug(`Action: ${action}`);
  logger.debug(`UserId: ${userId}`);

  if (action === 'stop-generation') {
    return await stopGeneration({
      sessionTableName: SESSION_TABLE_NAME,
      userId,
      request,
    });
  } else if (action === 'list-models') {
    return listModels();
  } else if (action === 'list-sessions') {
    return listSessions({
      sessionTableName: SESSION_TABLE_NAME,
      startTimeIndexName: SESSION_TABLE_START_TIME_INDEX_NAME,
      userId,
      request,
    });
  } else if (action === 'get-session') {
    return getSession({
      sessionTableName: SESSION_TABLE_NAME,
      userId,
      request,
    });
  } else if (action === 'clear-sessions') {
    return clearSessions({ sessionTableName: SESSION_TABLE_NAME, userId });
  }

  return {
    statusCode: 400,
    body: JSON.stringify({
      error: true,
      message: `Invalid action: ${action}`,
    }),
  };
}

export const handler = middy(actionHandler)
  // Use the middleware by passing the Metrics instance as a parameter
  .use(logMetrics(metrics))
  // Use the middleware by passing the Logger instance as a parameter
  .use(injectLambdaContext(logger, { logEvent: true }))
  // Use the middleware by passing the Tracer instance as a parameter
  .use(captureLambdaHandler(tracer, { captureResponse: false })); // by default the tracer would add the response as metadata on the segment, but there is a chance to hit the 64kb segment size limit. Therefore set captureResponse: false
