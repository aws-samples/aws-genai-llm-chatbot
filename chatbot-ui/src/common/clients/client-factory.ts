import { AppConfig, AppConfigClientName } from '../types';
import { LambdaStreamClient } from './lambda-stream-client';

export class ClientFactory {
  static getClient(appConfig: AppConfig | null) {
    if (!appConfig) return null;

    if (appConfig.client.name === AppConfigClientName.LAMBDA) {
      const client = new LambdaStreamClient(appConfig, appConfig.client);
      return client;
    } else {
      throw new Error(`Invalid client name "${appConfig.client.name}"`);
    }
  }
}
