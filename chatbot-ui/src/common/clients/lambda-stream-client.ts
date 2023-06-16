import { ChatMode } from '../chat-context/chat-state';
import { AppConfig, AppConfigLambdaClient } from '../types';
import { Utils } from '../utils';
import { GetSessionResult, LLMClientBase, ListSessionsResult } from './llm-client-base';

const MAX_RETRIES = 60;

export class LambdaStreamClient extends LLMClientBase {
  constructor(config: AppConfig, protected _lambdaClientConfig: AppConfigLambdaClient) {
    super(config);
  }

  override async makeRequest({
    modelId,
    mode,
    sessionId,
    prompt,
    onData,
    onError,
  }: {
    modelId: string;
    mode: ChatMode;
    sessionId: string | null;
    prompt: string;
    onData: (sessionId: string, content: string) => void;
    onError: (sessionId: string, error: any) => void;
  }) {
    let retryNumber = 0;

    while (retryNumber++ <= MAX_RETRIES) {
      let body: any = { modelId, mode, prompt };
      if (sessionId) {
        body = { ...body, sessionId };
      }

      const idToken = await this.getIdToken();
      const signedRequest = await Utils.signRequest({
        url: this._lambdaClientConfig.send_endpoint,
        method: 'POST',
        service: 'lambda',
        region: this._config.aws_project_region,
        idToken: idToken,
        data: JSON.stringify(body),
      });

      const response = await fetch(signedRequest.url, {
        method: signedRequest.method,
        mode: 'cors',
        cache: 'no-cache',
        headers: signedRequest.headers,
        body: signedRequest.data,
        referrer: 'client',
      });

      if (!response.ok) {
        if (response.status !== 429) {
          break;
        } else {
          await Utils.delay(1000);
        }
      } else if (response.body) {
        const reader = response.body.getReader();

        while (true) {
          const data = await reader.read();
          if (data.done) {
            break;
          }

          const chunks = new TextDecoder().decode(data.value);
          for (const chunk of chunks.split('\n')) {
            if (chunk.length === 0) continue;

            try {
              const chunkData: {
                sessionId: string;
                message?: string;
                error?: object;
              } = JSON.parse(chunk);

              if (chunkData.error) {
                console.error(chunkData);
                onError(chunkData.sessionId, chunkData.error);
                return;
              }

              if (chunkData.message) {
                onData(chunkData.sessionId, chunkData.message);
              } else {
                console.error('Empty message', chunkData);
                onError(chunkData.sessionId, chunkData.error);

                return;
              }
            } catch (e) {
              console.log(e);
            }
          }
        }

        break;
      }
    }
  }

  override async stopGeneration(sessionId: string | null): Promise<void> {
    return await this.makeActionRequest({ action: 'stop-generation', sessionId });
  }

  override async listModels(): Promise<string[] | null> {
    return await this.makeActionRequest({ action: 'list-models' });
  }

  override async listSessions(last: string): Promise<ListSessionsResult | null> {
    return this.makeActionRequest({ action: 'list-sessions', limit: 50, last });
  }

  override async getSession(sessionId: string): Promise<GetSessionResult | null> {
    return this.makeActionRequest({ action: 'get-session', sessionId });
  }

  override async clearSessions(): Promise<void> {
    return this.makeActionRequest({ action: 'clear-sessions' });
  }

  protected async makeActionRequest(body: object) {
    const idToken = await this.getIdToken();
    const signedRequest = await Utils.signRequest({
      url: this._lambdaClientConfig.action_endpoint,
      method: 'POST',
      service: 'lambda',
      region: this._config.aws_project_region,
      idToken: idToken,
      data: JSON.stringify(body),
    });

    const response = await fetch(signedRequest.url, {
      method: signedRequest.method,
      mode: 'cors',
      cache: 'no-cache',
      headers: signedRequest.headers,
      body: signedRequest.data,
      referrer: 'client',
    });

    if (response.ok) {
      const data = await response.json();

      if (data.error) {
        console.error(data);
        return null;
      }

      return data;
    } else {
      console.error(response);
    }

    return null;
  }
}
