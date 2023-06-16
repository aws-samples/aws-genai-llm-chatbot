import { SageMakerEndpoint, SageMakerLLMContentHandler } from 'langchain/llms/sagemaker_endpoint';

import { ChatMode, CompleteArgs, CompleteParams, ErrorArgs, GetPromptArgs, SessionHistoryItem, StreamArgs } from '../types';

const LARGE_LANGUAGE_MODELS = JSON.parse(process.env.LARGE_LANGUAGE_MODELS || '{}');
const MAX_ITERATIONS = 10000;
const MAX_GENERATION_LENGTH = 4096;

export abstract class ModelAdapterBase {
  protected readonly model: SageMakerEndpoint;
  protected readonly endpointName: string;
  protected readonly modelId: string;
  protected readonly mode: string | unknown;

  private _onStream: (arg0: StreamArgs) => Promise<void>;
  private _onComplete: (arg0: CompleteArgs) => Promise<void>;
  private _onError: (arg0: ErrorArgs) => Promise<void>;
  private _shouldStopGeneration: () => Promise<boolean>;
  private _onStoppedGeneration: () => Promise<void>;

  constructor(
    protected _config: {
      modelId: string;
      modelKwargs: Record<string, unknown>;
    },
  ) {
    this.modelId = this._config.modelId;
    this.mode = this._config.modelKwargs?.mode || ChatMode.Streaming;
    this.endpointName = LARGE_LANGUAGE_MODELS[this.modelId];

    this.model = new SageMakerEndpoint({
      endpointName: this.endpointName,
      contentHandler: this.getContentHandler(),
      modelKwargs: this._config.modelKwargs,
      maxRetries: 2,
      clientOptions: {
        region: process.env.AWS_REGION,
      },
    });
  }

  abstract getPrompt(args0: GetPromptArgs): Promise<string>;
  abstract getContentHandler(): SageMakerLLMContentHandler;
  abstract getStopWords(): Promise<string[]>;

  public async onStream(fn: (arg0: StreamArgs) => Promise<void>) {
    this._onStream = fn;
  }

  public async onComplete(fn: (arg0: CompleteArgs) => Promise<void>) {
    this._onComplete = fn;
  }

  public async onError(onError: (arg0: ErrorArgs) => Promise<void>) {
    this._onError = onError;
  }

  public async shouldStopGeneration(fn: () => Promise<boolean>) {
    this._shouldStopGeneration = fn;
  }

  public async onStoppedGeneration(fn: () => Promise<void>) {
    this._onStoppedGeneration = fn;
  }

  public async complete({ prompt, context, history }: CompleteParams) {
    const completion = {
      generatedText: '',
    };

    try {
      await this._complete({ prompt, history, context, completion });
    } catch (error) {
      console.log(`Error: ${error}`);
      await this._onError({ error: `${error}` });
    } finally {
      await this._onComplete({ prompt, history, generatedText: completion.generatedText });
    }
  }

  private async _complete({ prompt, history, context, completion }: GetPromptArgs): Promise<void> {
    console.log(`Calling complete with prompt: ${prompt}`);
    console.log(`Model: ${this.modelId}`);
    console.log(`Endpoint: ${this.endpointName}`);
    console.log(`Mode: ${this.mode}`);

    const initialPrompt = await this.getPrompt({ prompt, history, context, completion });
    let _prompt = initialPrompt;
    const timestamp = Date.now();
    console.log(`Timestamp: ${timestamp}`);

    // Streaming mode
    if (this.mode === ChatMode.Streaming) {
      console.log('Streaming mode enabled');

      let isEndOfText = false;
      let residual = '';
      const stops = await this.getStopWords();

      for (let i = 0; i < MAX_ITERATIONS; i++) {
        if (await this._shouldStopGeneration()) {
          console.log('Stopping generation');
          await this._onStoppedGeneration();
          break;
        }

        console.log(`_prompt: ${_prompt}`);
        const message = await this.model.call(_prompt);
        if (!message) {
          console.log('No message returned');
          break;
        }

        let currentIteration = message.replace(_prompt, '');
        if (currentIteration.length === 0) {
          break;
        }

        _prompt += currentIteration;
        completion.generatedText += currentIteration;
        currentIteration = residual + currentIteration;
        residual = '';

        let skipCnt = 0;
        for (const stopSequence of stops) {
          if (completion.generatedText.includes(stopSequence) || currentIteration.includes(stopSequence)) {
            isEndOfText = true;
            completion.generatedText = completion.generatedText.split(stopSequence)[0];
            currentIteration = currentIteration.split(stopSequence)[0];
          }

          for (let i = 0; i < stopSequence.length; i++) {
            if (currentIteration.endsWith(stopSequence.substring(0, i + 1))) {
              skipCnt = Math.max(i + 1, skipCnt);
            }
          }
        }

        if (skipCnt > 0) {
          residual = currentIteration.substring(currentIteration.length - skipCnt);
          currentIteration = currentIteration.slice(0, -skipCnt);
        }

        if (currentIteration.length > 0) {
          await this._onStream({
            timestamp,
            sender: 'system',
            message: currentIteration,
          });
        }

        console.log('length: ', completion.generatedText.length);

        if (completion.generatedText.length >= MAX_GENERATION_LENGTH || isEndOfText) {
          break;
        }
      }
    } else {
      // Standard mode
      console.log('Standard mode enabled');
      console.log('Calling model with context: ', _prompt);
      const message = await this.model.call(_prompt);
      const response = await this.isEndOfText(message.replace(_prompt, ''));
      console.log('message: ', message);
      console.log('response: ', response);
      completion.generatedText = response.text;

      await this._onStream({
        timestamp,
        sender: 'system',
        message: completion.generatedText,
      });
    }
  }

  protected async isEndOfText(text: string) {
    console.log(`Checking if end of text: ${text}`);
    let minIndex = text.length;
    let foundStop = false;
    const stops = await this.getStopWords();

    for (const word of stops) {
      console.log(`Checking for word: ${word}`);
      const index = text.indexOf(word);
      console.log(`Index: ${index}`);

      if (index >= 0 && index < minIndex) {
        console.log(`Found stop word: ${word} at index: ${index}`);
        minIndex = index;
        foundStop = true;
      }
    }
    const response = {
      endOfText: foundStop,
      text: text.slice(0, minIndex),
    };

    console.log(`Response: ${JSON.stringify(response)}`);
    return response;
  }

  protected truncateArgs({ prompt, history, context }: GetPromptArgs, limit: number) {
    const promptLength = prompt.length;
    let residualLength = limit - promptLength;

    if (residualLength <= 0) {
      return {
        prompt,
        history: [],
        contextString: '',
      };
    }

    let contextString = context.length > 0 ? context[0] : '';
    contextString = contextString.substring(0, residualLength);
    residualLength -= contextString.length;

    let truncatedHistoryLenght = 0;
    const truncatedHistory: SessionHistoryItem[] = [];

    for (let i = history.length - 1; i >= 0; i--) {
      if (truncatedHistoryLenght + history[i].content.length > residualLength) {
        break;
      }

      truncatedHistoryLenght += history[i].content.length;
      truncatedHistory.push(history[i]);
    }

    truncatedHistory.reverse();

    const retVlaue = {
      prompt,
      history: truncatedHistory,
      contextString,
    };

    return retVlaue;
  }
}
