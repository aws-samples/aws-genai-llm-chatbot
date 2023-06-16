import { logger } from '../common/powertools';

export async function listModels() {
  logger.debug(`Listing large language models`);
  logger.debug(process.env.LARGE_LANGUAGE_MODELS_IDS || 'Missing env var LARGE_LANGUAGE_MODELS_IDS');

  const models = process.env.LARGE_LANGUAGE_MODELS_IDS?.split(',') || [];
  logger.debug(`Large language models available: ${JSON.stringify(models)}`);

  return {
    statusCode: 200,
    body: JSON.stringify(models),
  };
}
